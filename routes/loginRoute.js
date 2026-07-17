const express = require("express");
const router = express.Router();
const prisma = require("@prisma/client").PrismaClient;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prismaClient = new prisma();
require("dotenv").config();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prismaClient.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.isActive === false) {
    return res.status(401).json({ error: "User is not active" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role,userName:user.name },
    process.env.JWT_SECRET,
    {
      expiresIn: "24h",
    }
  );

  res.json({
    message: "Login successful",
    token: token,
  });
});
module.exports = router;
