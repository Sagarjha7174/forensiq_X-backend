const bcrypt = require("bcrypt");
const prisma = require("../../config/database/prismaClient");
const { sendSubAdminCredentialsEmail } = require("../../utils/mailService");

const createUser = async (req, res) => {
  const { email, name, password, phone, course, classes, role } = req.body;
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        phone,
        degree: course,
        classes,
        role: role ? role.toUpperCase() : "STUDENT",
      },
    });

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      phone: newUser.phone,
      degree: newUser.degree,
      classes: newUser.classes,
      createdAt: newUser.createdAt,
    });
  } catch (error) {
    console.log(error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Email or Phone already exists" });
    }
    res
      .status(500)
      .json({ error: "An error occurred while creating the user." });
  }
};

const createSubAdmin = async (req, res) => {
  const { email, first_name, last_name, password, phone } = req.body;
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = await prisma.user.create({
      data: {
        email,
        name: `${first_name} ${last_name}`.trim(),
        password: hashedPassword,
        phone: phone && phone.trim() ? phone.trim() : null, // null if not provided (phone is now optional)
        degree: "Admin",
        classes: "Admin",
        role: "ADMIN",
        is_sub_admin: true,
        profileCompleted: true // Sub-admins don't need profile completion
      },
    });

    const loginUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/login` : 'https://forensiq.in/login';

    let emailSent = false;
    try {
      await sendSubAdminCredentialsEmail({
        to: newUser.email,
        fullName: newUser.name,
        tempPassword: password,
        loginUrl,
      });
      emailSent = true;
    } catch (mailError) {
      console.error('[MAIL] Failed to send sub-admin credentials:', mailError.message);
    }

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      is_sub_admin: newUser.is_sub_admin,
      emailSent
    });
  } catch (error) {
    console.log(error);
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Email or Phone already exists" });
    }
    res.status(500).json({ message: "An error occurred while creating sub-admin." });
  }
};

const listSubAdmins = async (_req, res) => {
  try {
    const subAdmins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        is_sub_admin: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        is_sub_admin: true,
        isActive: true,
        accountStatus: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(subAdmins);
  } catch (error) {
    console.error('Error listing sub-admins:', error);
    return res.status(500).json({ message: 'Failed to list sub-admins' });
  }
};

module.exports = { createUser, createSubAdmin, listSubAdmins };
