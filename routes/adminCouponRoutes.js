const express = require('express');
const { 
  getAllCoupons, 
  getCouponById, 
  createCoupon, 
  updateCoupon, 
  deleteCoupon, 
  toggleCouponStatus 
} = require('../controllers/coupon/adminCouponController');
const checkAdmin = require('../middlewares/checkAdmin');

const router = express.Router();

router.use(checkAdmin);
router.get('/', getAllCoupons);
router.get('/:id', getCouponById);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);
router.patch('/:id/toggle-status', toggleCouponStatus);

module.exports = router;
