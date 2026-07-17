const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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
      return res
        .status(403)
        .json({ error: "Forbidden: User not found or inactive" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Error verifying token:", err);
    return res.status(403).json({ error: "Token invalid or expired" });
  }
}

module.exports = verifyToken;
