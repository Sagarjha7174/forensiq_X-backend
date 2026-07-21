const express = require("express");
const router = express.Router();
const prisma = require("@prisma/client").PrismaClient;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prismaClient = new prisma();
require("dotenv").config();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  let user;
  try {
    user = await prismaClient.user.findUnique({ where: { email } });
  } catch (err) {
    console.error("Database error during login:", err.message);
    return res.status(500).json({ error: "Internal server error. Database unreachable." });
  }

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.password) {
    return res.status(401).json({ error: "This account uses Google Sign-In. Please log in with Google." });
  }
  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.isActive === false) {
    return res.status(401).json({ error: "User is not active" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.is_sub_admin ? 'SUBADMIN' : user.role,
      userName: user.name,
      profileCompleted: user.profileCompleted ?? true,
      is_sub_admin: Boolean(user.is_sub_admin),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "24h",
    }
  );

  res.json({
    message: "Login successful",
    token: token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.is_sub_admin ? 'SUBADMIN' : user.role,
      is_sub_admin: Boolean(user.is_sub_admin),
      profileCompleted: user.profileCompleted ?? true
    }
  });
});
module.exports = router;
