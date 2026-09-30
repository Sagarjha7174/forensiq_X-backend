const { PaymentStatus, EnrollmentStatus, EnrollmentSource } = require("@prisma/client");
const crypto = require("crypto");
const prisma = require("../../config/database/prismaClient");
const { orderConfirmationEmail, paymentIssueEmail } = require("../../utils/mailService");
const Cashfree = require("../../utils/cashfree");
const { CFEnvironment } = require("cashfree-pg");

exports.cashfreeWebhook = async (req, res) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];

    try {
        Cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch (err) {
        return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = req.body;

    /* =========================
       ✅ PAYMENT SUCCESS
    ========================= */
    if (event.type === "PAYMENT_SUCCESS_WEBHOOK") {
      const p = event.data.payment;
      const orderId = event.data.order.order_id;
      const paymentId = String(p.cf_payment_id);

      // Fetch payment first for fallback email
      const payment = await prisma.payment.findFirst({
        where: { cashfreeOrderId: orderId },
        include: { user: true, course: true }
      });

      if (!payment) return res.json({ status: "ignored - no payment record" });

      // Idempotency
      if (payment.status === PaymentStatus.SUCCESS) return res.json({ status: "ignored - already success" });

      // Security: amount check
      if (payment.amount !== p.payment_amount) {
        throw new Error("Amount mismatch");
      }

      let completedPaymentDetails = null;
      let transactionError = null;

      try {
        completedPaymentDetails = await prisma.$transaction(async (tx) => {
        const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        if (currentPayment.status === PaymentStatus.SUCCESS) return null;

        // Optimistic Concurrency Control: atomically update only if still CREATED
        const updateResult = await tx.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.CREATED },
          data: {
            cashfreePaymentId: paymentId,
            status: PaymentStatus.SUCCESS
          }
        });

        if (updateResult.count === 0) {
          // Another process (e.g., frontend) already updated this payment
          return null;
        }

          // Create Enrollment
          await tx.enrollment.create({
            data: {
              userId: payment.userId,
              courseId: payment.courseId,
              paymentId: payment.id,
              source: EnrollmentSource.PURCHASE,
              status: EnrollmentStatus.ACTIVE
            }
          });

          // Handle Coupon Usage
          if (payment.couponId) {
            await tx.coupon.update({
              where: { id: payment.couponId },
              data: { usedCount: { increment: 1 } }
            });
            
            await tx.couponUse.create({
              data: {
                couponId: payment.couponId,
                userId: payment.userId,
                paymentId: payment.id
              }
            });
          }
          
          return payment;
        });
      } catch (txErr) {
        console.error("Enrollment transaction failed in webhookCashfree:", txErr);
        transactionError = txErr;
      }

      // Send Order Confirmation Email
      if (completedPaymentDetails && completedPaymentDetails.user && completedPaymentDetails.user.email) {
        try {
          orderConfirmationEmail({
            to: completedPaymentDetails.user.email,
            fullName: completedPaymentDetails.user.name,
            details: {
              courseName: completedPaymentDetails.course.name,
              courseDescription: completedPaymentDetails.course.description,
              amount: completedPaymentDetails.amount,
              paymentId: paymentId,
              orderId: orderId
            }
          }).catch(err => console.error("Failed to send webhook order email:", err));
        } catch (err) {
          console.error("Error setting up webhook order email:", err);
        }
      } else if (transactionError) {
        // Concurrency check: Did the frontend process this exactly at the same time?
        const checkPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
        if (checkPayment && checkPayment.status === PaymentStatus.SUCCESS) {
          console.log("Transaction failed but payment is already SUCCESS (handled by frontend).");
          return res.json({ status: "ok", message: "Handled by frontend concurrently" });
        }

        // Transaction failed but payment was captured
        if (payment.user && payment.user.email) {
          try {
            paymentIssueEmail({
              to: payment.user.email,
              fullName: payment.user.name,
              details: {
                courseName: payment.course.name,
                amount: payment.amount,
                paymentId: paymentId,
                orderId: orderId
              }
            }).catch(err => console.error("Failed to send webhook payment issue email:", err));
          } catch (err) {
            console.error("Error setting up webhook payment issue email:", err);
          }
        }
        console.error("Webhook processing failed due to transaction error:", transactionError);
        return res.status(500).json({ error: "Enrollment transaction failed" });
      }
    }

    /* =========================
       ❌ PAYMENT FAILED
    ========================= */
    if (event.type === "PAYMENT_FAILED_WEBHOOK") {
      const p = event.data.payment;
      const orderId = event.data.order.order_id;

      await prisma.payment.updateMany({
        where: {
          cashfreeOrderId: orderId,
          status: { not: PaymentStatus.SUCCESS } // 🔒 do not downgrade
        },
        data: { status: PaymentStatus.FAILED }
      });
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};
