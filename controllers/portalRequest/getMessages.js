const prisma = require("../../config/database/prismaClient");

const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);

    const request = await prisma.portalRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (!isAdmin && request.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const messages = await prisma.portalMessage.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, role: true } }
      }
    });

    res.status(200).json({
      message: "Messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

module.exports = { getMessages };
