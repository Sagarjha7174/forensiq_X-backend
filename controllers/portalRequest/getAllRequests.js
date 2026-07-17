const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAllRequests = async (req, res) => {
  try {
    const { module_type, status } = req.query;

    // Check admin role
    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);
    
    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const whereClause = {};
    if (module_type) {
      whereClause.moduleType = module_type;
    }
    if (status) {
      whereClause.status = status;
    }

    const requests = await prisma.portalRequest.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true } }
      }
    });

    res.status(200).json({
      message: "All requests fetched successfully",
      data: requests,
    });
  } catch (error) {
    console.error("Error fetching all requests:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
};

module.exports = { getAllRequests };
