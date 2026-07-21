const jwt = require("jsonwebtoken");

const prisma = require("../config/database/prismaClient");

async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      console.log("verifyToken: User not found or inactive, ID:", decoded.id);
      return res
        .status(403)
        .json({ error: "Forbidden: User not found or inactive" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Error verifying token or fetching user:", err.message);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: "Token invalid or expired" });
    }
    return res.status(500).json({ error: "Internal server error during authentication" });
  }
}

module.exports = verifyToken;
