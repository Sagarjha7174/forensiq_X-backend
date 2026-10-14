const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const prisma = require("../config/database/prismaClient");
const { signAuthToken } = require("../utils/authToken");
const { clientRole, isSubAdmin } = require("../utils/roles");
const { isAccountUsable } = require("../middlewares/auth");
const { limiters } = require("../utils/rateLimiters");
const logger = require("../utils/logger");

// One message for every credential failure so the endpoint cannot be used to
// discover which emails are registered or which use Google sign-in.
const INVALID_CREDENTIALS =
  "Invalid credentials. If you signed up with Google, use \"Continue with Google\".";

// Unknown users still pay for one bcrypt comparison so response timing does not
// reveal whether the account exists.
const DUMMY_HASH = bcrypt.hashSync("forensiq-timing-equalizer", 10);

router.post("/login", limiters.loginByIp, limiters.loginByEmail, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  let user;
  try {
    // Exact match first; fall back to case-insensitive for mixed-case legacy rows.
    user =
      (await prisma.user.findUnique({ where: { email } })) ||
      (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }));
  } catch (err) {
    logger.error("Database error during login", { requestId: req.id, error: err });
    return res.status(500).json({ error: "Internal server error. Database unreachable." });
  }

  const passwordOk = await bcrypt.compare(password, user?.password || DUMMY_HASH);
  if (!user || !user.password || !passwordOk) {
    return res.status(401).json({ error: INVALID_CREDENTIALS });
  }

  if (!isAccountUsable(user)) {
    return res.status(401).json({ error: "User is not active" });
  }

  const token = signAuthToken(user);

  return res.json({
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: clientRole(user),
      is_sub_admin: isSubAdmin(user),
      profileCompleted: user.profileCompleted ?? true,
    },
  });
});

module.exports = router;
