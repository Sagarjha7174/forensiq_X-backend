const express = require('express');
const { validateCoupon } = require('../controllers/coupon/validateCouponController');
const verifyToken = require('../middlewares/auth');
const { limiters } = require('../utils/rateLimiters');

const router = express.Router();

router.use(verifyToken);

// Rate-limited to prevent coupon-code enumeration.
router.post('/validate', limiters.couponValidate, validateCoupon);

module.exports = router;
