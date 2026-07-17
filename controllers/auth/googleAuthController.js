const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../../config/database/prismaClient');
const { sendWelcomeEmail } = require('../../utils/mailService');
require('dotenv').config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleAuth = async (req, res) => {
  try {
    const { credential, role: requestedRole } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Missing Google credential' });
    }

    const allowedRoles = new Set(['STUDENT', 'CLIENT', 'INSTITUTION', 'PROFESSIONAL', 'MEMBER']);
    const role = requestedRole ? requestedRole.toUpperCase() : 'STUDENT';

    if (!allowedRoles.has(role)) {
      return res.status(403).json({ message: 'Google login is not available for this role' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Google Auth is not configured on backend' });
    }

    // Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ message: 'Invalid Google credential payload' });
    }

    const email = String(payload.email).toLowerCase();
    const fullName = payload.name || payload.given_name || email.split('@')[0];
    const profileImage = payload.picture || null;
    const googleId = payload.sub;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { google_id: googleId }
        ]
      }
    });

    if (user) {
      if (user.role === 'ADMIN' || user.role === 'SUBADMIN') {
        return res.status(403).json({ message: 'Google login is disabled for admin accounts' });
      }

      if (user.email !== email) {
        return res.status(400).json({
          message: 'Google account email does not match the existing user record.'
        });
      }

      // Existing user - verify role
      if (user.role !== role && user.role) {
        return res.status(400).json({
          message: `This email is registered as ${user.role}. Please use that role to login.`
        });
      }

      if (user.isActive === false) {
        return res.status(401).json({ error: "User is not active" });
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          google_id: googleId,
          auth_provider: 'google',
          profile_image: profileImage || user.profile_image
        }
      });
    } else {
      // New user
      const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          name: fullName,
          email,
          phone: googleId, // Use googleId as phone fallback if phone is required and unique
          password: randomPasswordHash,
          google_id: googleId,
          profile_image: profileImage,
          role,
          auth_provider: 'google',
          classes: 'none',
          degree: 'none'
        }
      });

      sendWelcomeEmail({
        to: user.email,
        fullName: user.name,
        role
      }).catch(err => console.error('[MAIL] sendWelcomeEmail failed in background:', err.message));
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, userName: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      message: 'Google login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile_image: user.profile_image
      }
    });
  } catch (error) {
    console.error('[GOOGLE-AUTH] Error:', error.message);
    return res.status(500).json({ message: 'Google authentication failed', error: error.message });
  }
};
