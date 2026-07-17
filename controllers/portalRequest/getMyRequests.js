const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getMyRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { module_type } = req.query;

    const whereClause = { userId };
    if (module_type) {
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
    console.error("Error fetching my requests:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
};

module.exports = { getMyRequests };
