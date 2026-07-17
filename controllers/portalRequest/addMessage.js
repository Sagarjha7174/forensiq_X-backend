const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, client_temp_id } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);

    // Verify request exists
    const request = await prisma.portalRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (!isAdmin && request.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const newMessage = await prisma.portalMessage.create({
      data: {
        requestId: id,
        userId,
        message,
        isAdmin,
        client_temp_id: client_temp_id || null
      },
      include: {
        user: { select: { name: true, role: true } }
      }
    });

    res.status(201).json({
      message: "Message added successfully",
      data: newMessage,
    });
  } catch (error) {
    console.error("Error adding message:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
};

module.exports = { addMessage };
