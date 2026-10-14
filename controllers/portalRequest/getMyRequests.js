const prisma = require("../../config/database/prismaClient");
const { serverError } = require("../../utils/httpErrors");
const { isStaff } = require("../../utils/roles");

const getMyRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { module_type } = req.query;

    const whereClause = { userId };
    if (typeof module_type === 'string' && module_type) {
      whereClause.moduleType = module_type;
    }

    const requests = await prisma.portalRequest.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json({
      message: "Requests fetched successfully",
      data: requests,
    });
  } catch (error) {
    return serverError(res, error, "Failed to fetch requests", req);
  }
};

module.exports = { getMyRequests };
