const { isSubAdmin } = require('../../utils/roles');

/**
 * GET /api/v1/auth/me   (requires verifyToken)
 * Returns the authenticated user's profile, including the profileCompleted flag.
 * Frontend uses this (not JWT decoding) to determine onboarding state.
 */
exports.getMe = async (req, res) => {
  const u = req.user;
  return res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      is_sub_admin: isSubAdmin(u),
      profile_image: u.profile_image,
      profileCompleted: u.profileCompleted,
      hasPassword: Boolean(u.password),
      classes: u.classes,
      degree: u.degree,
      auth_provider: u.auth_provider,
      createdAt: u.createdAt
    }
  });
};
