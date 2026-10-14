const express = require('express');
const router = express.Router();
const { forgotPassword, resetPasswordWithOtp } = require('../controllers/auth/recoveryController');
const { googleAuth } = require('../controllers/auth/googleAuthController');
const { completeProfile } = require('../controllers/auth/completeProfileController');
const { getMe } = require('../controllers/auth/meController');
const verifyToken = require('../middlewares/auth');
const { limiters } = require('../utils/rateLimiters');

// Password recovery (OTP via email): IP + per-email limits, plus a DB attempt counter.
router.post('/forgot-password', limiters.forgotPasswordByIp, limiters.forgotPasswordByEmail, forgotPassword);
router.post('/reset-password', limiters.resetPasswordByIp, limiters.resetPasswordByEmail, resetPasswordWithOtp);

// Google OAuth
router.post('/google-auth', limiters.googleAuth, googleAuth);

// Profile completion after Google signup (requires a valid, active session)
router.post('/complete-profile', verifyToken, limiters.completeProfile, completeProfile);

// Get current authenticated user
router.get('/me', verifyToken, getMe);

module.exports = router;
