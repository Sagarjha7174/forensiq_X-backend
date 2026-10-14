const { PaymentStatus } = require("@prisma/client");
const prisma = require("../../config/database/prismaClient");
const { orderConfirmationEmail } = require("../../utils/mailService");
const Cashfree = require("../../utils/cashfree");
const { fulfillPayment, amountMatches } = require("../../services/paymentFulfillment");
const logger = require("../../utils/logger");

/**
 * POST /api/webhooks/cashfree   (raw body — see routes/webhookRoutes.js)
 *
 * 1. Verify x-webhook-signature = base64(HMAC-SHA256(timestamp + rawBody, secret)) over the
 *    EXACT bytes received (cashfree-pg PGVerifyWebhookSignature).
 * 2. Only then parse JSON.
 * 3. Validate order id, amount, currency and payment status against our payment record.
 * 4. Fulfil idempotently (services/paymentFulfillment).
 *
 * Responses: 2xx = processed/ignored (Cashfree stops retrying); 4xx = invalid request;
 * 5xx = transient failure (Cashfree retries).
 */
exports.cashfreeWebhook = async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
  const signature = req.get("x-webhook-signature");
  const timestamp = req.get("x-webhook-timestamp");

  if (!rawBody || !signature || !timestamp) {
    return res.status(400).json({ error: "Invalid webhook request" });
  }

  try {
    Cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
  } catch {
    logger.warn("Cashfree webhook signature verification failed", { requestId: req.id });
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Malformed webhook payload" });
  }

  const type = event?.type;
  const order = event?.data?.order;
  const p = event?.data?.payment;
  const orderId = order?.order_id;

  if (typeof orderId !== "string" || !orderId) {
    return res.status(400).json({ error: "Malformed webhook payload" });
  }

  try {
    if (type === "PAYMENT_SUCCESS_WEBHOOK") {
      if (p?.payment_status !== "SUCCESS") {
        return res.json({ status: "ignored - not a successful payment" });
      }

      const payment = await prisma.payment.findFirst({ where: { cashfreeOrderId: orderId } });
      if (!payment) {
        logger.warn("Webhook for unknown order", { orderId });
        return res.json({ status: "ignored - no payment record" });
      }
      if (payment.status === PaymentStatus.SUCCESS) {
        return res.json({ status: "ignored - already success" });
      }

      const currency = order.order_currency || p.payment_currency;
      const paidAmount = p.payment_amount ?? order.order_amount;
      if (!amountMatches(paidAmount, payment.amount) || (currency && currency !== "INR")) {
        logger.error("Webhook amount/currency mismatch; payment NOT fulfilled", {
          orderId,
          paymentId: payment.id,
          expected: payment.amount,
          received: paidAmount,
          currency,
        });
        return res.json({ status: "rejected - amount mismatch" });
      }

      const result = await fulfillPayment({
        paymentId: payment.id,
        cashfreePaymentId: p.cf_payment_id,
        via: "webhook",
      });

      if (!result.alreadyProcessed) {
        const full = await prisma.payment.findUnique({
          where: { id: payment.id },
          include: { user: { select: { email: true, name: true } }, course: { select: { name: true } } },
        });
        if (full?.user?.email) {
          orderConfirmationEmail({
            to: full.user.email,
            fullName: full.user.name,
            details: {
              courseName: full.course.name,
              amount: full.amount,
              originalAmount: full.originalAmount || full.amount,
              discountAmount: full.discountAmount || 0,
              paymentId: String(p.cf_payment_id),
              orderId,
            },
          }).catch((err) => logger.error("Failed to send webhook order email", { orderId, error: err }));
        }
      }

      return res.json({ status: "ok" });
    }

    if (type === "PAYMENT_FAILED_WEBHOOK") {
      await prisma.payment.updateMany({
        where: { cashfreeOrderId: orderId, status: PaymentStatus.CREATED }, // never downgrade SUCCESS
        data: { status: PaymentStatus.FAILED },
      });
      return res.json({ status: "ok" });
    }

    // PAYMENT_USER_DROPPED_WEBHOOK, refunds, etc.: acknowledged, no state change.
    return res.json({ status: "ignored" });
  } catch (err) {
    logger.error("Webhook processing failed (will be retried by Cashfree)", { orderId, type, error: err });
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};
