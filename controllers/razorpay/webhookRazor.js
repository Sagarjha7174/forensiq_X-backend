// controllers/webhook.controller.js
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body.toString());

    /* =========================
       ✅ PAYMENT SUCCESS
    ========================= */
    if (event.event === "payment.captured") {
      const p = event.payload.payment.entity;

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { razorpayOrderId: p.order_id }
        });

        if (!payment) return;

        // Idempotency
        if (payment.status === "SUCCESS") return;

        // Security: amount check
        if (payment.amount*100 !== p.amount) {
          throw new Error("Amount mismatch");
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId: p.id,
            status: "SUCCESS"
          }
        });

        // CRITICAL FIX: Create Enrollment
        await tx.enrollment.create({
          data: {
            userId: payment.userId,
            courseId: payment.courseId,
            paymentId: payment.id,
            source: "PURCHASE",
            status: "ACTIVE"
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
      });
    }

    /* =========================
       ❌ PAYMENT FAILED
    ========================= */
    if (event.event === "payment.failed") {
      const p = event.payload.payment.entity;

      await prisma.payment.updateMany({
        where: {
          razorpayOrderId: p.order_id,
          status: { not: "SUCCESS" } // 🔒 do not downgrade
        },
        data: { status: "FAILED" }
      });
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};
