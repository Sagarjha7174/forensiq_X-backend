const prisma = require("../../config/database/prismaClient");
const { serverError } = require("../../utils/httpErrors");
const { isStaff } = require("../../utils/roles");

const getAllRequests = async (req, res) => {
  try {
    const { module_type, status } = req.query;

    // Check admin role
    const isAdmin = isStaff(req.user);
    
    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const whereClause = {};
    if (typeof module_type === 'string' && module_type) {
      whereClause.moduleType = module_type;
    }
    if (typeof status === 'string' && status) {
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
    return serverError(res, error, "Failed to fetch requests", req);
  }
};

module.exports = { getAllRequests };
