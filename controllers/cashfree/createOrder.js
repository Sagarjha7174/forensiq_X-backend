const { PaymentStatus, EnrollmentStatus, EnrollmentSource } = require("@prisma/client");
const prisma = require("../../config/database/prismaClient");
const Cashfree = require("../../utils/cashfree");
const { validateAndCalculateDiscount, CouponValidationError } = require("../../services/couponValidationService");
const { orderConfirmationEmail } = require("../../utils/mailService");

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

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const alreadyPurchased = await prisma.payment.findFirst({
      where: {
        userId,
        courseId,
        status: PaymentStatus.SUCCESS
      }
    });

    if (alreadyPurchased) {
      return res.status(400).json({
        message: "Course already purchased"
      });
    }

    await prisma.payment.deleteMany({
      where: {
        userId,
        courseId,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.FAILED] }
      }
    });

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

    if (finalAmount === 0) {
      const payment = await prisma.payment.create({
        data: {
          userId,
          courseId,
          cashfreeOrderId: `free_${Date.now()}_${userId}`,
          cashfreePaymentId: `free_${Date.now()}`,
          amount: 0,
          originalAmount: course.price,
          discountAmount: discountAmount,
          couponId: appliedCouponId,
          status: PaymentStatus.SUCCESS
        }
      });

      await prisma.enrollment.create({
        data: {
          userId,
          courseId,
          paymentId: payment.id,
          source: EnrollmentSource.PURCHASE,
          status: EnrollmentStatus.ACTIVE
        }
      });

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

      if (user && user.email) {
        orderConfirmationEmail({
          to: user.email,
          fullName: user.name,
          details: {
            courseName: course.name,
            courseDescription: course.description,
            amount: 0,
            paymentId: payment.cashfreePaymentId,
            orderId: payment.cashfreeOrderId
          }
        }).catch(err => console.error("Failed to send free order email:", err));
      }

      return res.json({
        isFree: true,
        message: "Course activated successfully for free"
      });
    }

    // Cashfree minimum amount is generally ₹1
    const orderId = `cf_${Date.now()}_${userId.slice(0, 10)}`;
    const request = {
      order_amount: finalAmount, // Cashfree expects amount in rupees, not paise
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: userId,
        customer_phone: user.phone || "9999999999",
        customer_email: user.email,
        customer_name: user.name
      }
    };

    const response = await Cashfree.PGCreateOrder(request);

    await prisma.payment.create({
      data: {
        userId,
        courseId,
        cashfreeOrderId: orderId,
        amount: finalAmount,
        originalAmount: course.price,
        discountAmount: discountAmount,
        couponId: appliedCouponId,
        status: PaymentStatus.CREATED
      }
    });

    res.json({
      orderId: orderId,
      paymentSessionId: response.data.payment_session_id,
      amount: finalAmount,
      originalAmount: course.price,
      discountAmount
    });
  } catch (err) {
    console.error("Create order error:", err.response?.data || err);
    res.status(500).json({ error: "Failed to create order" });
  }
};
