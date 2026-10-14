const prisma = require('../../config/database/prismaClient');
const { sendWelcomeEmail } = require('../../utils/mailService');
const { verifyGoogleCredential } = require('../../utils/googleVerifier');
const { signAuthToken } = require('../../utils/authToken');
const { PUBLIC_ROLES, normalizeRole, isStaff, clientRole } = require('../../utils/roles');
const { isAccountUsable } = require('../../middlewares/auth');
const { serverError } = require('../../utils/httpErrors');
const logger = require('../../utils/logger');

/**
 * POST /api/v1/auth/google-auth
 * Body: { credential: <Google ID token or OAuth access token>, role?: public role }
 */
exports.googleAuth = async (req, res) => {
  try {
    const { credential, role: requestedRole } = req.body || {};

    // Google sign-in / sign-up is only for public (non-staff) roles.
    const role = requestedRole ? normalizeRole(requestedRole) : 'STUDENT';
    if (!PUBLIC_ROLES.includes(role)) {
      return res.status(403).json({ message: 'Google login is not available for this role' });
    }

    let identity;
    try {
      identity = await verifyGoogleCredential(credential);
    } catch (err) {
      const status = err.status || 401;
      return res.status(status).json({ message: err.expose ? err.message : 'Invalid Google credential' });
    }

    const { email, sub: googleId } = identity;
    const fullName = (identity.name || email.split('@')[0]).slice(0, 120);
    const profileImage = identity.picture || null;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { google_id: googleId }
        ]
      }
    });

    if (user) {
      // Staff accounts must use password login (no Google takeover of admin accounts).
      if (isStaff(user)) {
        return res.status(403).json({ message: 'Google login is disabled for admin accounts' });
      }

      if (user.email.toLowerCase() !== email) {
        return res.status(400).json({
          message: 'Google account email does not match the existing user record.'
        });
      }

      // A different Google account must not take over an account already linked to Google.
      if (user.google_id && user.google_id !== googleId) {
        return res.status(400).json({ message: 'This email is linked to a different Google account.' });
      }

      if (user.role && normalizeRole(user.role) !== role) {
        return res.status(400).json({
          message: `This email is registered as ${user.role}. Please use that role to login.`
        });
      }

      if (!isAccountUsable(user)) {
        return res.status(401).json({ error: 'User is not active', message: 'User is not active' });
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          google_id: googleId,
          // keep auth_provider "email" for accounts that also have a password
          auth_provider: user.password ? user.auth_provider : 'google',
          profile_image: user.profile_image || profileImage
        }
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: fullName,
          email,
          google_id: googleId,
          profile_image: profileImage,
          role,
          is_sub_admin: false,
          auth_provider: 'google',
          password: null,          // No password for Google users initially
          phone: null,             // Collected post-login
          classes: null,           // Collected post-login
          degree: null,            // Collected post-login
          profileCompleted: false  // Will show completion modal on dashboard
        }
      });

      sendWelcomeEmail({
        to: user.email,
        fullName: user.name,
        role
      }).catch(err => logger.error('sendWelcomeEmail failed', { error: err }));
    }

    const token = signAuthToken(user);

    return res.json({
      message: 'Google login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: clientRole(user),
        profile_image: user.profile_image,
        profileCompleted: user.profileCompleted
      }
    });
  } catch (error) {
    return serverError(res, error, 'Google authentication failed', req);
  }
};
