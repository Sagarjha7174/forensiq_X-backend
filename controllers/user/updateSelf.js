const prisma = require("../../config/database/prismaClient");

const updateSelf = async (req, res) => {
  const uid = req.user.id; // from verifyToken middleware
  const { name, phone, degree, classes } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: uid }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updateData = {
      name: name ?? user.name,
      phone: phone ?? user.phone,
      degree: degree ?? user.degree,
      classes: classes ?? user.classes,
    };

    const updatedUser = await prisma.user.update({
      where: { id: uid },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        degree: true,
        classes: true
      }
    });

    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { updateSelf };
