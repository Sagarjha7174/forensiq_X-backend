const { validateAndCalculateDiscount, CouponValidationError } = require("../../services/couponValidationService");

exports.validateCoupon = async (req, res) => {
  try {
    const { code, courseId } = req.body;
    const userId = req.user.id;

    if (!code || !courseId) {
      return res.status(400).json({ error: "Code and courseId are required" });
    }

    const result = await validateAndCalculateDiscount(code, courseId, userId);
    
    res.json({
      message: "Coupon is valid",
      ...result
    });

  } catch (err) {
    if (err instanceof CouponValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Coupon validation error:", err);
    res.status(500).json({ error: "Internal server error during validation" });
  }
};
