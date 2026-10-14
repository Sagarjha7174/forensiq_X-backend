const bcrypt = require("bcrypt");
const prisma = require("../../config/database/prismaClient");
const { validatePassword } = require("../../utils/passwordPolicy");
const { signAuthToken } = require("../../utils/authToken");
const { serverError } = require("../../utils/httpErrors");

/**
 * PUT /api/v1/user/change-password
 * Requires the current password. Accounts without a password (Google sign-up) must
 * use the password-reset flow to set one. Changing the password invalidates all
 * previously issued tokens (see utils/authToken passwordFingerprint); a fresh token
 * for the current session is returned.
 */
const changePassword = async (req, res) => {
  const uid = req.user.id;
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  try {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.password) {
      return res.status(400).json({ error: "This account has no password yet. Use \"Forgot password\" to set one." });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      // 400 (not 401): a wrong current password must not look like an expired session to the client.
      return res.status(400).json({ error: "Invalid current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: uid },
      data: { password: hashedPassword },
    });

    return res.json({ message: "Password updated successfully", token: signAuthToken(updated) });
  } catch (error) {
    return serverError(res, error, "Internal server error", req);
  }
};

module.exports = { changePassword };
