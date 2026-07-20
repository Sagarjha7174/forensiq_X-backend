const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class CouponValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CouponValidationError";
  }
}

/**
 * Validates a coupon code and calculates the final amount
 * @param {string} code - The coupon code
 * @param {string} courseId - The ID of the course being purchased
 * @param {string} userId - The ID of the user attempting to use the coupon
 * @returns {Promise<{ originalAmount: number, discountAmount: number, finalAmount: number, couponId: string }>}
 */
exports.validateAndCalculateDiscount = async (code, courseId, userId) => {
  if (!code) throw new CouponValidationError("Coupon code is required");

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
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

  // Check per-user limit
  const userUsage = await prisma.couponUse.count({
    where: { couponId: coupon.id, userId: userId }
  });
  if (userUsage >= coupon.perUserLimit) {
    throw new CouponValidationError(`You have reached the usage limit for this coupon`);
  }

  // Check applicable course
  if (coupon.applicableTo === "SELECTED_COURSES") {
    const isApplicable = coupon.courses.some(c => c.id === courseId);
    if (!isApplicable) {
      throw new CouponValidationError("This coupon is not valid for this course");
    }
  }

  // Fetch course to get price
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new CouponValidationError("Course not found");

  const originalAmount = course.price; // assuming price is stored in rupees (or base unit)

  // Check minimum purchase amount
  if (coupon.minimumPurchaseAmount && originalAmount < coupon.minimumPurchaseAmount) {
    throw new CouponValidationError(`This coupon requires a minimum purchase of ₹${coupon.minimumPurchaseAmount}`);
  }

  // First purchase only check
  if (coupon.firstPurchaseOnly) {
    const previousPayments = await prisma.payment.findFirst({
      where: { userId: userId, status: "SUCCESS" }
    });
    if (previousPayments) {
      throw new CouponValidationError("This coupon is only valid for first-time purchases");
    }
  }

  // Calculate discount
  let discountAmount = 0;

  switch (coupon.discountType) {
    case "PERCENTAGE":
      discountAmount = Math.floor((originalAmount * coupon.discountValue) / 100);
      break;
    case "FIXED_AMOUNT":
      discountAmount = coupon.discountValue;
      break;
    case "FREE_COURSE":
      discountAmount = originalAmount;
      break;
    case "FLAT_PRICE":
      discountAmount = Math.max(0, originalAmount - coupon.discountValue);
      break;
    default:
      throw new CouponValidationError("Unknown discount type");
  }

  // Apply maximum discount cap if present
  if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
    discountAmount = coupon.maxDiscountAmount;
  }

  // Ensure discount doesn't exceed original amount
  if (discountAmount > originalAmount) {
    discountAmount = originalAmount;
  }

  const finalAmount = originalAmount - discountAmount;

  return {
    originalAmount,
    discountAmount,
    finalAmount,
    couponId: coupon.id
  };
};

exports.CouponValidationError = CouponValidationError;
