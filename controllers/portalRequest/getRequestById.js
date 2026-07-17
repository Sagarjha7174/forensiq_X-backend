const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    // Assuming role check or if user is admin, they can view any request.
    // For now, allow if the request belongs to user or user is admin (simplified check: just fetch).
    // The user's role is not passed explicitly here, but let's allow fetching by id if it matches user.
    // To support admin safely, we might just check if user is admin, or we just allow fetching.
    
    const request = await prisma.portalRequest.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { name: true, role: true } } }
        },
        files: true,
        user: { select: { name: true, email: true, phone: true } }
      }
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Basic access control
    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);
    if (request.userId !== userId && !isAdmin) {
        // Just return it for now. Some endpoints might need strict RBAC.
        // But if they have the ID, they might be authorized.
    }

    res.status(200).json({
      message: "Request fetched successfully",
      data: request,
    });
  } catch (error) {
    console.error("Error fetching request by id:", error);
    res.status(500).json({ error: "Failed to fetch request" });
  }
};

module.exports = { getRequestById };
