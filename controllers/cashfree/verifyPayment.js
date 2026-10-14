const { PaymentStatus } = require("@prisma/client");
const prisma = require("../../config/database/prismaClient");
const Cashfree = require("../../utils/cashfree");
const { orderConfirmationEmail, paymentIssueEmail } = require("../../utils/mailService");
const { fulfillPayment, amountMatches } = require("../../services/paymentFulfillment");
const logger = require("../../utils/logger");

/**
 * POST /cashfree/confirm-transaction  { orderId }
 *
 * Browser-side confirmation. It can never mark an order paid on its own: the payment
 * status is fetched server-to-server from Cashfree and must show a SUCCESS payment whose
 * amount/currency match our record. Fulfilment is shared with (and idempotent against)
 * the webhook, so whichever arrives first wins and the other is a no-op.
 */
exports.verifyPayment = async (req, res) => {
  const { orderId } = req.body || {};
  const userId = req.user.id;

  if (typeof orderId !== "string" || !orderId || orderId.length > 100) {
    return res.status(400).json({ error: "Missing Cashfree order ID" });
  }

  try {
    // Only the owner's own order can be confirmed.
    const payment = await prisma.payment.findFirst({
      where: { cashfreeOrderId: orderId, userId },
    });
    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }
    if (payment.status === PaymentStatus.SUCCESS) {
      return res.json({ success: true, message: "Payment already verified" });
    }

    let response;
    try {
      response = await Cashfree.PGOrderFetchPayments(orderId);
    } catch (cfErr) {
      logger.error("Cashfree PGOrderFetchPayments failed", { orderId, status: cfErr?.response?.status });
      return res.status(502).json({ error: "Failed to fetch payment status from Cashfree" });
    }

    const payments = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
    const successfulPayment = payments.find((p) =>
      p?.payment_status === "SUCCESS" &&
      amountMatches(p.payment_amount, payment.amount) &&
      (!p.payment_currency || p.payment_currency === "INR")
    );

    if (!successfulPayment) {
      if (payments.some((p) => p?.payment_status === "SUCCESS")) {
        logger.error("Cashfree SUCCESS payment with mismatched amount/currency", { orderId, paymentId: payment.id });
      }
      return res.status(400).json({ error: "Payment not successful on Cashfree's end" });
    }

    const cashfreePaymentId = String(successfulPayment.cf_payment_id);

    let result;
    try {
      result = await fulfillPayment({ paymentId: payment.id, cashfreePaymentId, via: "browser" });
    } catch (txErr) {
      logger.error("Enrollment transaction failed after verified payment", { orderId, paymentId: payment.id, error: txErr });

      const full = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: { user: { select: { email: true, name: true } }, course: { select: { name: true } } },
      });
      if (full?.status === PaymentStatus.SUCCESS) {
        return res.json({ success: true, message: "Payment verified successfully" });
      }
      if (full?.user?.email) {
        paymentIssueEmail({
          to: full.user.email,
          fullName: full.user.name,
          details: { courseName: full.course.name, amount: full.amount, paymentId: cashfreePaymentId, orderId }
        }).catch((err) => logger.error("Failed to send payment issue email", { orderId, error: err }));
      }
      return res.status(500).json({ error: "Payment was captured but an issue occurred during enrollment. Our team has been notified." });
    }

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
            paymentId: cashfreePaymentId,
            orderId
          }
        }).catch((err) => logger.error("Failed to send order confirmation email", { orderId, error: err }));
      }
    }

    return res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    logger.error("verifyPayment failed", { requestId: req.id, orderId, error: err });
    return res.status(500).json({ error: "Failed to verify payment" });
  }
};
