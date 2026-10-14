const crypto = require("crypto");
const { PaymentStatus, EnrollmentStatus, EnrollmentSource } = require("@prisma/client");
const prisma = require("../../config/database/prismaClient");
const Cashfree = require("../../utils/cashfree");
const { validateAndCalculateDiscount, CouponValidationError } = require("../../services/couponValidationService");
const { orderConfirmationEmail } = require("../../utils/mailService");
const { serverError } = require("../../utils/httpErrors");
const logger = require("../../utils/logger");

/**
 * Per-order webhook URL, so Cashfree delivers payment webhooks even if the dashboard
 * webhook setting is missing. PUBLIC_API_URL = public origin of this API (https only),
 * e.g. https://forensiqapi.sagarjha.in
 */
const webhookNotifyUrl = () => {
  const base = (process.env.PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  return /^https:\/\//.test(base) ? `${base}/api/webhooks/cashfree` : null;
};

class CheckoutError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Purchase eligibility shared by the paid and free paths. */
async function assertCanPurchase(db, userId, course) {
  if (!course) throw new CheckoutError(404, "Course not found");
  if (course.status !== "ACTIVE") throw new CheckoutError(400, "This course is not available for purchase");

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { status: true },
  });
  if (enrollment?.status === EnrollmentStatus.ACTIVE) {
    throw new CheckoutError(400, "You are already enrolled in this course");
  }
  if (enrollment) {
    throw new CheckoutError(403, "Your access to this course is currently suspended. Please contact support.");
  }

  const alreadyPurchased = await db.payment.findFirst({
    where: { userId, courseId: course.id, status: PaymentStatus.SUCCESS },
    select: { id: true },
  });
  if (alreadyPurchased) throw new CheckoutError(400, "Course already purchased");
}

/**
 * Zero-amount checkout (free course or 100% coupon). Runs in one transaction, serialized
 * per user+course, with eligibility and coupon limits re-checked inside the lock and the
 * coupon usage counter incremented atomically against its limit.
 */
async function completeFreeCheckout({ userId, course, couponCode }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${userId}:${course.id}`}))`;
    await assertCanPurchase(tx, userId, course);

    let discountAmount = 0;
    let couponId = null;
    if (couponCode) {
      const v = await validateAndCalculateDiscount(couponCode, course.id, userId, tx);
      if (v.finalAmount !== 0) throw new CheckoutError(409, "Coupon no longer makes this course free; please retry");
      discountAmount = v.discountAmount;
      couponId = v.couponId;

      // Serialize per coupon+user for the per-user limit, then consume one global use atomically.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`coupon:${couponId}:${userId}`}))`;
      const again = await validateAndCalculateDiscount(couponCode, course.id, userId, tx);
      if (again.finalAmount !== 0) throw new CheckoutError(409, "Coupon is no longer valid");

      const consumed = await tx.coupon.updateMany({
        where: v.usageLimit ? { id: couponId, usedCount: { lt: v.usageLimit } } : { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
      if (consumed.count === 0) throw new CouponValidationError("This coupon's usage limit has been reached");
    }

    const payment = await tx.payment.create({
      data: {
        userId,
        courseId: course.id,
        cashfreeOrderId: `free_${crypto.randomUUID()}`,
        cashfreePaymentId: `free_${crypto.randomUUID()}`,
        amount: 0,
        originalAmount: course.price,
        discountAmount,
        couponId,
        status: PaymentStatus.SUCCESS,
      },
    });

    await tx.enrollment.create({
      data: {
        userId,
        courseId: course.id,
        paymentId: payment.id,
        source: EnrollmentSource.PURCHASE,
        status: EnrollmentStatus.ACTIVE,
        activatedAt: new Date(),
      },
    });

    if (couponId) {
      await tx.couponUse.create({ data: { couponId, userId, paymentId: payment.id } });
    }

    return { payment, discountAmount };
  }, { timeout: 15000, maxWait: 5000 });
}

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, couponCode } = req.body || {};

    if (typeof courseId !== "string" || !courseId) {
      return res.status(400).json({ error: "courseId is required" });
    }
    if (couponCode !== undefined && couponCode !== null && couponCode !== "" && typeof couponCode !== "string") {
      return res.status(400).json({ error: "Invalid coupon code" });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    await assertCanPurchase(prisma, userId, course);

    // Price is always computed server-side from the DB course price and coupon rules.
    let finalAmount = course.price;
    let discountAmount = 0;
    let appliedCouponId = null;
    if (couponCode) {
      const validation = await validateAndCalculateDiscount(couponCode, courseId, userId);
      finalAmount = validation.finalAmount;
      discountAmount = validation.discountAmount;
      appliedCouponId = validation.couponId;
    }

    if (!Number.isInteger(finalAmount) || finalAmount < 0) {
      logger.error("Computed invalid order amount", { courseId, finalAmount });
      return res.status(500).json({ error: "Failed to create order" });
    }

    if (finalAmount === 0) {
      const { payment, discountAmount: appliedDiscount } = await completeFreeCheckout({ userId, course, couponCode: couponCode || null });

      orderConfirmationEmail({
        to: req.user.email,
        fullName: req.user.name,
        details: {
          courseName: course.name,
          amount: 0,
          originalAmount: course.price,
          discountAmount: appliedDiscount,
          paymentId: payment.cashfreePaymentId,
          orderId: payment.cashfreeOrderId,
          couponCode: couponCode || null,
        }
      }).catch(err => logger.error("Failed to send free order email", { error: err }));

      return res.json({
        isFree: true,
        message: "Course activated successfully for free"
      });
    }

    // Paid path: persist the order BEFORE creating it at Cashfree, so a payment can never
    // be captured for an order we have no record of. Earlier CREATED/FAILED records are kept
    // (a late success on an old order must still be fulfilled by the webhook).
    const orderId = `cf_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    await prisma.payment.create({
      data: {
        userId,
        courseId,
        cashfreeOrderId: orderId,
        amount: finalAmount,
        originalAmount: course.price,
        discountAmount,
        couponId: appliedCouponId,
        status: PaymentStatus.CREATED
      }
    });

    const request = {
      order_amount: finalAmount, // Cashfree expects rupees
      order_currency: "INR",
      order_id: orderId,
      ...(webhookNotifyUrl() ? { order_meta: { notify_url: webhookNotifyUrl() } } : {}),
      customer_details: {
        customer_id: userId,
        customer_phone: req.user.phone || "9999999999",
        customer_email: req.user.email,
        customer_name: req.user.name
      }
    };

    let response;
    try {
      response = await Cashfree.PGCreateOrder(request);
    } catch (cfErr) {
      await prisma.payment.updateMany({
        where: { cashfreeOrderId: orderId, status: PaymentStatus.CREATED },
        data: { status: PaymentStatus.FAILED },
      });
      logger.error("Cashfree PGCreateOrder failed", { orderId, status: cfErr?.response?.status });
      return res.status(502).json({ error: "Failed to create order" });
    }

    return res.json({
      orderId,
      paymentSessionId: response.data.payment_session_id,
      amount: finalAmount,
      originalAmount: course.price,
      discountAmount
    });
  } catch (err) {
    if (err instanceof CheckoutError) return res.status(err.status).json({ error: err.message, message: err.message });
    if (err instanceof CouponValidationError) return res.status(400).json({ error: err.message });
    if (err.code === "P2002") return res.status(409).json({ error: "This purchase is already being processed" });
    return serverError(res, err, "Failed to create order", req);
  }
};
