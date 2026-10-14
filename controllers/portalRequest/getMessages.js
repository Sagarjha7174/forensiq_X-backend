const prisma = require("../../config/database/prismaClient");
const { findAccessibleRequest, notFound } = require("../../utils/portalAccess");
const { serverError } = require("../../utils/httpErrors");

const getMessages = async (req, res) => {
  try {
    const request = await findAccessibleRequest(req.user, req.params.id);
    if (!request) return notFound(res);

    const messages = await prisma.portalMessage.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, role: true } }
      }
    });

    return res.status(200).json({
      message: "Messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    return serverError(res, error, "Failed to fetch messages", req);
  }
};

module.exports = { getMessages };
