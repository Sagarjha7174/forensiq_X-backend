const express = require('express');
const {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus
} = require('../controllers/coupon/adminCouponController');
const { requireStaff, requireFullAdmin } = require('../middlewares/checkAdmin');

const router = express.Router();

// Reads: any staff. Writes affect pricing / revenue: full administrators only.
router.get('/', requireStaff, getAllCoupons);
router.get('/:id', requireStaff, getCouponById);
router.post('/', requireFullAdmin, createCoupon);
router.put('/:id', requireFullAdmin, updateCoupon);
router.delete('/:id', requireFullAdmin, deleteCoupon);
router.patch('/:id/toggle-status', requireFullAdmin, toggleCouponStatus);

module.exports = router;
