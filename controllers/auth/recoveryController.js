const bcrypt = require('bcrypt');
const prisma = require('../../config/database/prismaClient');
const { sendPasswordResetEmail } = require('../../utils/mailService');

exports.forgotPassword = async (req, res) => {
  try {
    const raw = String(req.body.email || '').trim().toLowerCase();
    const generic = {
      message: 'If an account exists for this email, a 6-digit verification code was sent.'
    };

    if (!raw || !raw.includes('@')) {
      return res.json(generic);
    }

    const user = await prisma.user.findFirst({
      where: {
        email: raw
      }
    });

    if (!user) {
      return res.json(generic);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetOtp.deleteMany({
      where: { email: user.email }
    });

    await prisma.passwordResetOtp.create({
      data: {
        email: user.email,
        otp_hash: otpHash,
        expires_at: expiresAt
      }
    });

    sendPasswordResetEmail({
      to: user.email,
      fullName: user.name,
      resetData: otp
    }).catch(err => console.error('[MAIL] sendPasswordResetEmail failed in background:', err.message));

    return res.json(generic);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to process request', error: error.message });
  }
};

exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!email || !otp || newPassword.length < 6) {
      return res.status(400).json({ message: 'email, 6-digit code, and new password (min 6 chars) are required' });
    }

    const user = await prisma.user.findFirst({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const row = await prisma.passwordResetOtp.findFirst({
      where: { email: user.email }
    });

    if (!row || new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const ok = await bcrypt.compare(otp, row.otp_hash);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    await prisma.passwordResetOtp.delete({
      where: { id: row.id }
    });

    return res.json({ message: 'Password updated. You can sign in with your new password.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to reset password', error: error.message });
  }
};
