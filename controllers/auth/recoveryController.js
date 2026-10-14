const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../../config/database/prismaClient');
const { sendPasswordResetEmail } = require('../../utils/mailService');
const { validatePassword } = require('../../utils/passwordPolicy');
const logger = require('../../utils/logger');

/**
 * Password recovery with emailed 6-digit OTP.
 *
 * Protections:
 *  - OTP from a CSPRNG (crypto.randomInt), stored only as a bcrypt hash, valid 15 minutes,
 *    single use (deleted on success).
 *  - Max OTP_MAX_ATTEMPTS wrong guesses per code, counted atomically in the database
 *    (works across instances / restarts). The counter is carried over when a new code is
 *    requested within LOCK_WINDOW_MS, so requesting new codes does not reset it.
 *  - Once the limit is hit, no new code is issued for that account until the lock window
 *    passes (temporary; never a permanent lock-out).
 *  - Resend cooldown, IP + per-email rate limits (routes/authRoutes.js).
 *  - Identical responses whether or not the account exists (no enumeration).
 */
const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const GENERIC_FORGOT = {
  message: 'If an account exists for this email, a 6-digit verification code was sent.'
};
const INVALID_CODE = { message: 'Invalid or expired verification code' };

const isMissingColumn = (err) => err?.code === 'P2022' || /column .*attempts.* does not exist/i.test(err?.message || '');
const unavailable = (res, err) => {
  logger.error('Password reset unavailable: database schema is missing PasswordResetOtp.attempts (run the migration)', { error: err });
  return res.status(503).json({ message: 'Password reset is temporarily unavailable. Please try again later.' });
};

const findUserByEmail = async (email) =>
  (await prisma.user.findUnique({ where: { email } })) ||
  (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }));

const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

exports.forgotPassword = async (req, res) => {
  try {
    const raw = String(req.body?.email || '').trim().toLowerCase();
    if (!raw || !raw.includes('@') || raw.length > 254) {
      return res.json(GENERIC_FORGOT);
    }

    const user = await findUserByEmail(raw);
    if (!user || user.isActive === false || user.accountStatus === 'BLOCKED') {
      return res.json(GENERIC_FORGOT);
    }

    const now = Date.now();
    const existing = await prisma.passwordResetOtp.findUnique({ where: { email: user.email } });
    const withinLockWindow = existing && now - new Date(existing.createdAt).getTime() < LOCK_WINDOW_MS;

    if (existing && withinLockWindow && existing.attempts >= OTP_MAX_ATTEMPTS) {
      logger.warn('Password reset requested while locked', { userId: user.id });
      return res.json(GENERIC_FORGOT);
    }
    if (existing && now - new Date(existing.createdAt).getTime() < RESEND_COOLDOWN_MS) {
      return res.json(GENERIC_FORGOT);
    }

    const otp = generateOtp();
    const data = {
      otp_hash: await bcrypt.hash(otp, 10),
      expires_at: new Date(now + OTP_TTL_MS),
      attempts: withinLockWindow ? existing.attempts : 0,
      createdAt: new Date(now),
    };

    await prisma.passwordResetOtp.upsert({
      where: { email: user.email },
      create: { email: user.email, ...data },
      update: data,
    });

    sendPasswordResetEmail({
      to: user.email,
      fullName: user.name,
      resetData: otp
    }).catch(err => logger.error('sendPasswordResetEmail failed', { userId: user.id, error: err }));

    return res.json(GENERIC_FORGOT);
  } catch (error) {
    if (isMissingColumn(error)) return unavailable(res, error);
    logger.error('forgotPassword failed', { requestId: req.id, error });
    return res.status(500).json({ message: 'Unable to process request' });
  }
};

exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!email || !/^\d{6}$/.test(otp) || !newPassword) {
      return res.status(400).json({ message: 'email, 6-digit code, and new password are required' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json(INVALID_CODE);

    const row = await prisma.passwordResetOtp.findUnique({ where: { email: user.email } });
    if (!row || new Date(row.expires_at) < new Date()) {
      return res.status(400).json(INVALID_CODE);
    }

    // Consume one attempt atomically BEFORE comparing, so parallel guesses cannot exceed the limit.
    const consumed = await prisma.passwordResetOtp.updateMany({
      where: { id: row.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (consumed.count === 0) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code later.' });
    }

    const ok = await bcrypt.compare(otp, row.otp_hash);
    if (!ok) {
      return res.status(400).json(INVALID_CODE);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Delete the OTP (single use) and set the password in one transaction. The new password
    // hash changes the token fingerprint, so all existing sessions are invalidated.
    await prisma.$transaction([
      prisma.passwordResetOtp.delete({ where: { id: row.id } }),
      prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
    ]);

    return res.json({ message: 'Password updated. You can sign in with your new password.' });
  } catch (error) {
    if (isMissingColumn(error)) return unavailable(res, error);
    if (error.code === 'P2025') return res.status(400).json(INVALID_CODE); // already used concurrently
    logger.error('resetPasswordWithOtp failed', { requestId: req.id, error });
    return res.status(500).json({ message: 'Unable to reset password' });
  }
};
