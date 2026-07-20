const express = require('express');
const { validateCoupon } = require('../controllers/coupon/validateCouponController');
const verifyToken = require('../middlewares/auth');

const router = express.Router();

router.use(verifyToken);
router.post('/validate', validateCoupon);

module.exports = router;
