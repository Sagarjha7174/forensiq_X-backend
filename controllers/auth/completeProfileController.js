const bcrypt = require('bcrypt');
const prisma = require('../../config/database/prismaClient');
const { signAuthToken } = require('../../utils/authToken');
const { validatePassword } = require('../../utils/passwordPolicy');
const { serverError } = require('../../utils/httpErrors');

/**
 * POST /api/v1/auth/complete-profile   (requires verifyToken)
 * Called after Google signup to collect phone (required) and optionally set an
 * INITIAL password. It can never replace an existing password: that requires the
 * current password (PUT /user/change-password) or the OTP reset flow.
 * Returns a fresh JWT only after the update is committed.
 */
exports.completeProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, password, classes, degree } = req.body || {};

    if (typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    const wantsPassword = typeof password === 'string' && password !== '';
    if (wantsPassword) {
      if (req.user.password) {
        return res.status(400).json({
          message: 'A password is already set for this account. Use "Change password" instead.'
        });
      }
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ message: passwordError });
    }

    const existingPhone = await prisma.user.findFirst({
      where: { phone: phone.trim(), NOT: { id: userId } }
    });
    if (existingPhone) {
      return res.status(400).json({ message: 'This phone number is already registered' });
    }

    const updateData = {
      phone: phone.trim(),
      profileCompleted: true
    };
    if (typeof classes === 'string' && classes.trim()) updateData.classes = classes.trim().slice(0, 120);
    if (typeof degree === 'string' && degree.trim()) updateData.degree = degree.trim().slice(0, 120);
    if (wantsPassword) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Only set the password if it is still empty at write time (guards against races).
    const where = wantsPassword ? { id: userId, password: null } : { id: userId };
    const result = await prisma.user.updateMany({ where, data: updateData });
    if (result.count === 0) {
      return res.status(409).json({ message: 'Profile could not be updated; please retry.' });
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    const newToken = signAuthToken(updatedUser);

    return res.json({
      message: 'Profile completed successfully',
      token: newToken,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        profile_image: updatedUser.profile_image,
        profileCompleted: updatedUser.profileCompleted,
        classes: updatedUser.classes,
        degree: updatedUser.degree
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'This phone number is already registered' });
    }
    return serverError(res, error, 'Failed to complete profile', req);
  }
};
