-- Security hardening: OTP brute-force counter for password reset codes.
-- Additive and non-destructive. Safe to run more than once.
-- Apply BEFORE deploying the backend code that reads PasswordResetOtp.attempts
-- (until applied, /auth/forgot-password and /auth/reset-password return 503; nothing else is affected).
--
--   psql "$DIRECT_URL" -f config/database/migrations/manual/20261014_password_reset_otp_attempts.sql
--   (or: npm run db:push  — Prisma will add the same column; review its plan first)
--
-- Rollback (only if the code is rolled back too):
--   ALTER TABLE "PasswordResetOtp" DROP COLUMN IF EXISTS "attempts";

ALTER TABLE "PasswordResetOtp" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
