const express = require('express');
const router = express.Router();

const { forgotPassword, resetPasswordWithOtp } = require('../controllers/auth/recoveryController');
const { googleAuth } = require('../controllers/auth/googleAuthController');
const { completeProfile } = require('../controllers/auth/completeProfileController');
const { getMe } = require('../controllers/auth/meController');

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordWithOtp);
router.post('/google-auth', googleAuth);
router.post('/complete-profile', completeProfile);
router.get('/me', getMe);

module.exports = router;
