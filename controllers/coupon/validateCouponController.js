const { validateAndCalculateDiscount, CouponValidationError } = require("../../services/couponValidationService");
const { serverError } = require("../../utils/httpErrors");

exports.validateCoupon = async (req, res) => {
  try {
    const { code, courseId } = req.body || {};
    const userId = req.user.id;

    if (typeof code !== "string" || !code || typeof courseId !== "string" || !courseId) {
      return res.status(400).json({ error: "Code and courseId are required" });
    }

    const { originalAmount, discountAmount, finalAmount, couponId } = await validateAndCalculateDiscount(code, courseId, userId);

    return res.json({
      message: "Coupon is valid",
      originalAmount,
      discountAmount,
      finalAmount,
      couponId
    });
  } catch (err) {
    if (err instanceof CouponValidationError) {
      return res.status(400).json({ error: err.message });
    }
    return serverError(res, err, "Internal server error during validation", req);
  }
};
