const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
require("dotenv").config();

async function checkPermission(req, res, next) {
  const adminMail = process.env.ADMIN_EMAIL;
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(403).json({ message: "Token not provided" });
  }

  try {
    // Decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user along with their role and permissions
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === "SUPERADMIN") {
      return next();
    }

    // Check if the user has the required permissions
    else {
      return res
        .status(403)
        .json({ message: "Access denied: insufficient permissions" });
    }
  } catch (error) {
    console.error("Error verifying token:", error);
    return res
      .status(401)
      .json({ message: "Invalid token or authorization error" });
  }
}

module.exports = checkPermission;
