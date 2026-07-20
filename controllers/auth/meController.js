const jwt = require('jsonwebtoken');
const prisma = require('../../config/database/prismaClient');
require('dotenv').config();

/**
 * GET /api/v1/auth/me
 * Returns authenticated user's profile including profileCompleted flag.
 * Frontend uses this (not JWT decoding) to determine onboarding state.
 */
exports.getMe = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Missing authorization token' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profile_image: true,
        profileCompleted: true,
        classes: true,
        degree: true,
        auth_provider: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('[ME] Error:', error.message);
    return res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
};
