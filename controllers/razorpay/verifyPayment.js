const { PaymentStatus, EnrollmentStatus, EnrollmentSource } = require("@prisma/client");
const crypto = require("crypto");
const prisma = require("../../config/database/prismaClient");
const { orderConfirmationEmail, paymentIssueEmail } = require("../../utils/mailService");

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing Razorpay payment details" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Fetch payment details outside transaction for fallback email
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: razorpay_order_id, userId },
      include: { user: true, course: true }
    });

    if (!payment) return res.status(404).json({ error: "Payment record not found" });

    // Idempotency check: if already processed
    if (payment.status === PaymentStatus.SUCCESS) {
      return res.json({ success: true, message: "Payment already verified" });
    }

    let completedPaymentDetails = null;
    let transactionError = null;

    try {
      completedPaymentDetails = await prisma.$transaction(async (tx) => {
        const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        if (currentPayment.status === PaymentStatus.SUCCESS) {
          return null;
        }

        // Optimistic Concurrency Control: atomically update only if still CREATED
        const updateResult = await tx.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.CREATED },
          data: {
            razorpayPaymentId: razorpay_payment_id,
            status: PaymentStatus.SUCCESS
          }
        });

        if (updateResult.count === 0) {
          // Another process (e.g., webhook) already updated this payment
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
      console.error("Enrollment transaction failed in verifyPayment:", txErr);
      transactionError = txErr;
    }

    // Send Order Confirmation Email if this request actually processed the payment successfully
    if (completedPaymentDetails && completedPaymentDetails.user && completedPaymentDetails.user.email) {
      orderConfirmationEmail({
        to: completedPaymentDetails.user.email,
        fullName: completedPaymentDetails.user.name,
        details: {
          courseName: completedPaymentDetails.course.name,
          courseDescription: completedPaymentDetails.course.description,
          amount: completedPaymentDetails.amount,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id
        }
      }).catch(err => console.error("Failed to send frontend verify order email:", err));
    } else if (transactionError) {
      // Concurrency check: Did the webhook process this exactly at the same time?
      const checkPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      if (checkPayment && checkPayment.status === PaymentStatus.SUCCESS) {
        console.log("Transaction failed but payment is already SUCCESS (handled by webhook).");
        return res.json({ success: true, message: "Payment verified successfully" });
      }

      // Payment was captured by Razorpay, but our enrollment transaction truly failed!
      // Send a Payment Issue email to alert the student and admin.
      if (payment.user && payment.user.email) {
        paymentIssueEmail({
          to: payment.user.email,
          fullName: payment.user.name,
          details: {
            courseName: payment.course.name,
            amount: payment.amount,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id
          }
        }).catch(err => console.error("Failed to send payment issue email:", err));
      }
      
      // Return a gentle error message instead of raw Prisma error
      return res.status(500).json({ error: "Payment was captured but an issue occurred during enrollment. Our team has been notified." });
    }

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: err.message || "Failed to verify payment" });
  }
};
