const express = require('express');
const router = express.Router();

const { forgotPassword, resetPasswordWithOtp } = require('../controllers/auth/recoveryController');
const { googleAuth } = require('../controllers/auth/googleAuthController');

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordWithOtp);
router.post('/google-auth', googleAuth);

module.exports = router;
