const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const razorpay = require("./../../utils/razorpay");
const { validateAndCalculateDiscount, CouponValidationError } = require("../../services/couponValidationService");

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, couponCode } = req.body;


    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    /* =========================
       1️⃣ Block if already purchased
    ========================= */
    const alreadyPurchased = await prisma.payment.findFirst({
      where: {
        userId,
        courseId,
        status: "SUCCESS"
      }
    });

    if (alreadyPurchased) {
      return res.status(400).json({
        message: "Course already purchased"
      });
    }

    /* =========================
       2️⃣ Cleanup old attempts
    ========================= */
    await prisma.payment.deleteMany({
      where: {
        userId,
        courseId,
        status: { in: ["CREATED", "FAILED"] }
      }
    });

    /* =========================
       2.5️⃣ Validate Coupon (If provided)
    ========================= */
    let finalAmount = course.price;
    let discountAmount = 0;
    let appliedCouponId = null;

    if (couponCode) {
      try {
        const validation = await validateAndCalculateDiscount(couponCode, courseId, userId);
        finalAmount = validation.finalAmount;
        discountAmount = validation.discountAmount;
        appliedCouponId = validation.couponId;
      } catch (err) {
        if (err instanceof CouponValidationError) {
          return res.status(400).json({ error: err.message });
        }
        throw err;
      }
    }

    // Edge Case: If final amount is 0 (Free Course), we might bypass Razorpay entirely.
    // For now, Razorpay has a minimum order amount (usually 1 INR). 
    // If finalAmount === 0, we can directly create SUCCESS payment and trigger webhook/enrollment logic manually.
    // However, Razorpay does NOT allow 0 amount orders.
    if (finalAmount === 0) {
      // Create SUCCESS payment directly
      const payment = await prisma.payment.create({
        data: {
          userId,
          courseId,
          razorpayOrderId: `free_${Date.now()}_${userId}`,
          razorpayPaymentId: `free_${Date.now()}`,
          amount: 0,
          originalAmount: course.price,
          discountAmount: discountAmount,
          couponId: appliedCouponId,
          status: "SUCCESS"
        }
      });

      // Create Enrollment
      await prisma.enrollment.create({
        data: {
          userId,
          courseId,
          paymentId: payment.id,
          source: "PURCHASE",
          status: "ACTIVE"
        }
      });

      // Create CouponUse
      if (appliedCouponId) {
        await prisma.coupon.update({
          where: { id: appliedCouponId },
          data: { usedCount: { increment: 1 } }
        });
        await prisma.couponUse.create({
          data: {
            couponId: appliedCouponId,
            userId,
            paymentId: payment.id
          }
        });
      }

      return res.json({
        isFree: true,
        message: "Course activated successfully for free"
      });
    }

    /* =========================
       3️⃣ Create fresh Razorpay order
    ========================= */
    const order = await razorpay.orders.create({
      amount: finalAmount * 100, // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    });

    /* =========================
       4️⃣ Store payment attempt
    ========================= */
    await prisma.payment.create({
      data: {
        userId,
        courseId,
        razorpayOrderId: order.id,
        amount: finalAmount,
        originalAmount: course.price,
        discountAmount: discountAmount,
        couponId: appliedCouponId,
        status: "CREATED"
      }
    });

    /* =========================
       5️⃣ Send to frontend
    ========================= */
    res.json({
      orderId: order.id,
      amount: finalAmount,
      originalAmount: course.price,
      discountAmount,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
};
