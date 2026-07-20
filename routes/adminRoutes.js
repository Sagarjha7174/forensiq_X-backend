const express = require('express');
const {
  listPendingStaffActions,
  listStaffActionHistory,
  reviewStaffAction
} = require('../controllers/admin/staffApprovalController');
const { createSubAdmin } = require('../controllers/user/createUser'); // We will create this
const { verifyPassword } = require('../controllers/admin/verifyPassword');
const checkAdmin = require('../middlewares/checkAdmin');

const router = express.Router();

router.use(checkAdmin);
router.get('/staff-actions/pending', listPendingStaffActions);
router.get('/staff-actions/history', listStaffActionHistory);
router.patch('/staff-actions/:id', reviewStaffAction);
router.post('/sub-admins', createSubAdmin); // Needs implementation
router.post('/verify-password', verifyPassword);
router.use('/coupons', require('./adminCouponRoutes'));

module.exports = router;
