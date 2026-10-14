const defaultPrisma = require("../config/database/prismaClient");

class CouponValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CouponValidationError";
  }
}

/**
 * Validates a coupon code and calculates the final amount (server-side only; client-supplied
 * amounts are never trusted).
 * @param {string} code - The coupon code
 * @param {string} courseId - The ID of the course being purchased
 * @param {string} userId - The ID of the user attempting to use the coupon
 * @param {object} [db] - Prisma client or transaction client (for in-transaction re-validation)
 * @returns {Promise<{ originalAmount: number, discountAmount: number, finalAmount: number, couponId: string, usageLimit: number|null }>}
 */
exports.validateAndCalculateDiscount = async (code, courseId, userId, db = defaultPrisma) => {
  if (!code || typeof code !== "string" || code.length > 64) throw new CouponValidationError("Coupon code is required");

  const coupon = await db.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { courses: { select: { id: true } } }
  });

  if (!coupon) throw new CouponValidationError("Invalid coupon code");
  if (!coupon.isActive) throw new CouponValidationError("This coupon is no longer active");

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) throw new CouponValidationError("This coupon is not yet valid");
  if (coupon.validUntil && now > coupon.validUntil) throw new CouponValidationError("This coupon has expired");

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponValidationError("This coupon's usage limit has been reached");
  }

  const userUsage = await db.couponUse.count({
    where: { couponId: coupon.id, userId: userId }
  });

  if (userUsage >= coupon.perUserLimit) {
    throw new CouponValidationError(`You have reached the usage limit for this coupon`);
  }

  if (coupon.applicableTo === "SELECTED_COURSES") {
    const isApplicable = coupon.courses.some(c => c.id === courseId);
    if (!isApplicable) {
      throw new CouponValidationError("This coupon is not valid for this course");
    }
  }

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new CouponValidationError("Course not found");
  if (course.status !== "ACTIVE") throw new CouponValidationError("This course is not available for purchase");

  const originalAmount = course.price; // stored in rupees

  if (coupon.minimumPurchaseAmount && originalAmount < coupon.minimumPurchaseAmount) {
    throw new CouponValidationError(`This coupon requires a minimum purchase of ₹${coupon.minimumPurchaseAmount}`);
  }

  if (coupon.firstPurchaseOnly) {
    const previousPayments = await db.payment.findFirst({
      where: { userId: userId, status: "SUCCESS" }
    });
    if (previousPayments) {
      throw new CouponValidationError("This coupon is only valid for first-time purchases");
    }
  }

  let discountAmount = 0;
  switch (coupon.discountType) {
    case "PERCENTAGE":
      discountAmount = Math.floor((originalAmount * Math.min(Math.max(coupon.discountValue, 0), 100)) / 100);
      break;
    case "FIXED_AMOUNT":
      discountAmount = Math.max(0, coupon.discountValue);
      break;
    case "FREE_COURSE":
      discountAmount = originalAmount;
      break;
    case "FLAT_PRICE":
      discountAmount = Math.max(0, originalAmount - Math.max(0, coupon.discountValue));
      break;
    default:
      throw new CouponValidationError("Unknown discount type");
  }

  if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
    discountAmount = coupon.maxDiscountAmount;
  }
  if (discountAmount > originalAmount) {
    discountAmount = originalAmount;
  }

  const finalAmount = originalAmount - discountAmount;

  return {
    originalAmount,
    discountAmount,
    finalAmount,
    couponId: coupon.id,
    usageLimit: coupon.usageLimit ?? null,
  };
};

exports.CouponValidationError = CouponValidationError;
