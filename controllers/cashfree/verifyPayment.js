const { PaymentStatus, EnrollmentStatus, EnrollmentSource } = require("@prisma/client");
const prisma = require("../../config/database/prismaClient");
const Cashfree = require("../../utils/cashfree");
const { orderConfirmationEmail, paymentIssueEmail } = require("../../utils/mailService");

exports.verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    console.log("[verifyPayment] Called with orderId:", orderId, "userId:", userId);

    if (!orderId) {
      return res.status(400).json({ error: "Missing Cashfree order ID" });
    }

    // Fetch the payment details from Cashfree to verify
    let response;
    try {
      response = await Cashfree.PGOrderFetchPayments(orderId);
      console.log("[verifyPayment] Cashfree API raw response:", JSON.stringify(response?.data || response, null, 2));
    } catch (cfErr) {
      console.error("[verifyPayment] Cashfree API error:", cfErr?.response?.data || cfErr);
      return res.status(502).json({ error: "Failed to fetch payment status from Cashfree" });
    }
    
    // PGOrderFetchPayments returns data in different shapes depending on SDK version
    const payments = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
    console.log("[verifyPayment] Payments array length:", payments.length);
    
    const successfulPayment = payments.find(p => p.payment_status === "SUCCESS");

    if (!successfulPayment) {
      console.log("[verifyPayment] No successful payment found. Statuses:", payments.map(p => p.payment_status));
      return res.status(400).json({ error: "Payment not successful on Cashfree's end" });
    }

    console.log("[verifyPayment] Found successful payment:", successfulPayment.cf_payment_id);
    const cashfreePaymentId = String(successfulPayment.cf_payment_id);

    // Fetch payment details outside transaction for fallback email
    const payment = await prisma.payment.findFirst({
      where: { cashfreeOrderId: orderId, userId },
      include: { user: true, course: true }
    });

    if (!payment) {
      console.log("[verifyPayment] No payment record in DB for orderId:", orderId);
      return res.status(404).json({ error: "Payment record not found" });
    }

    console.log("[verifyPayment] DB payment status:", payment.status, "id:", payment.id);

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
          console.log("[verifyPayment] Already SUCCESS inside transaction");
          return null;
        }

        // Optimistic Concurrency Control: atomically update only if still CREATED
        const updateResult = await tx.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.CREATED },
          data: {
            cashfreePaymentId: cashfreePaymentId,
            status: PaymentStatus.SUCCESS
          }
        });

        console.log("[verifyPayment] Payment update count:", updateResult.count);

        if (updateResult.count === 0) {
          return null;
        }

        // Create Enrollment
        const enrollment = await tx.enrollment.create({
          data: {
            userId: payment.userId,
            courseId: payment.courseId,
            paymentId: payment.id,
            source: EnrollmentSource.PURCHASE,
            status: EnrollmentStatus.ACTIVE
          }
        });

        console.log("[verifyPayment] ✅ Enrollment created:", enrollment.id);

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
      console.error("[verifyPayment] Enrollment transaction failed:", txErr);
      transactionError = txErr;
    }

    console.log("[verifyPayment] Transaction result:", completedPaymentDetails ? "SUCCESS" : "NULL", "Error:", !!transactionError);

    // Send Order Confirmation Email
    if (completedPaymentDetails && completedPaymentDetails.user && completedPaymentDetails.user.email) {
      orderConfirmationEmail({
        to: completedPaymentDetails.user.email,
        fullName: completedPaymentDetails.user.name,
        details: {
          courseName: completedPaymentDetails.course.name,
          courseDescription: completedPaymentDetails.course.description,
          amount: completedPaymentDetails.amount,
          paymentId: cashfreePaymentId,
          orderId: orderId
        }
      }).catch(err => console.error("Failed to send frontend verify order email:", err));
    } else if (transactionError) {
      const checkPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      if (checkPayment && checkPayment.status === PaymentStatus.SUCCESS) {
        console.log("Transaction failed but payment is already SUCCESS (handled by webhook).");
        return res.json({ success: true, message: "Payment verified successfully" });
      }

      if (payment.user && payment.user.email) {
        paymentIssueEmail({
          to: payment.user.email,
          fullName: payment.user.name,
          details: {
            courseName: payment.course.name,
            amount: payment.amount,
            paymentId: cashfreePaymentId,
            orderId: orderId
          }
        }).catch(err => console.error("Failed to send payment issue email:", err));
      }
      
      return res.status(500).json({ error: "Payment was captured but an issue occurred during enrollment. Our team has been notified." });
    }

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    console.error("Verify payment error:", err.response?.data || err);
    res.status(500).json({ error: err.message || "Failed to verify payment" });
  }
};
