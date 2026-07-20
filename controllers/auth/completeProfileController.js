const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database/prismaClient');
require('dotenv').config();

/**
 * POST /api/v1/auth/complete-profile
 * Called after Google signup to collect phone (required) and optionally set a password.
 * Sets profileCompleted = true and returns a fresh JWT.
 */
exports.completeProfile = async (req, res) => {
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

    const userId = decoded.id;
    const { phone, password, classes, degree } = req.body;

    // Phone is required
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Validate phone format (10 digits)
    if (!/^\d{10}$/.test(phone.trim())) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // If password is provided, validate it
    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
    }

    // Check if phone is already taken by another user
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

    if (classes) updateData.classes = classes;
    if (degree) updateData.degree = degree;

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profile_image: true,
        profileCompleted: true,
        classes: true,
        degree: true
      }
    });

    // Issue a fresh JWT with profileCompleted = true
    const newToken = jwt.sign(
      {
        id: updatedUser.id,
        role: updatedUser.role,
        userName: updatedUser.name,
        profileCompleted: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Profile completed successfully',
      token: newToken,
      user: updatedUser
    });
  } catch (error) {
    console.error('[COMPLETE-PROFILE] Error:', error.message);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'This phone number is already registered' });
    }
    return res.status(500).json({ message: 'Failed to complete profile', error: error.message });
  }
};
