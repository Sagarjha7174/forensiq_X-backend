const express = require('express');
const {
  listPendingStaffActions,
  listStaffActionHistory,
  reviewStaffAction
} = require('../controllers/admin/staffApprovalController');
const { createSubAdmin, listSubAdmins } = require('../controllers/user/createUser');
const { verifyPassword } = require('../controllers/admin/verifyPassword');
const { requireStaff, requireFullAdmin } = require('../middlewares/checkAdmin');
const { limiters } = require('../utils/rateLimiters');

const router = express.Router();

// Every admin route requires at least staff (ADMIN / SUPERADMIN / sub-admin).
router.use(requireStaff);

// Approval queue: only full administrators may list, approve or reject staff actions.
router.get('/staff-actions/pending', requireFullAdmin, listPendingStaffActions);
router.get('/staff-actions/history', requireFullAdmin, listStaffActionHistory);
router.patch('/staff-actions/:id', requireFullAdmin, reviewStaffAction);

// Sub-admin management: full administrators only.
router.get('/sub-admins', requireFullAdmin, listSubAdmins);
router.post('/sub-admins', requireFullAdmin, createSubAdmin);

// Re-authentication check used by sensitive admin UI actions (any staff, own password).
router.post('/verify-password', limiters.adminVerifyPassword, verifyPassword);

// Coupons: staff may read; writes are full-admin only (see adminCouponRoutes).
router.use('/coupons', require('./adminCouponRoutes'));

module.exports = router;
