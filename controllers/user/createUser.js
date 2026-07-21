const bcrypt = require("bcrypt");
const prisma = require("../../config/database/prismaClient");

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

    // In a full implementation, you'd send an email here using Azure.
    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      is_sub_admin: newUser.is_sub_admin
    });
  } catch (error) {
    console.log(error);
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Email or Phone already exists" });
    }
    res.status(500).json({ message: "An error occurred while creating sub-admin." });
  }
};

module.exports = { createUser, createSubAdmin };
