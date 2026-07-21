const bcrypt = require("bcrypt");
const prisma = require("../../config/database/prismaClient");

const changePassword = async (req, res) => {
  const uid = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: uid }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: uid },
      data: { password: hashedPassword }
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { changePassword };
