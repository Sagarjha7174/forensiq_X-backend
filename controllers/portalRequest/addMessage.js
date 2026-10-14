const prisma = require("../../config/database/prismaClient");
const { findAccessibleRequest, notFound, isStaff } = require("../../utils/portalAccess");
const { serverError } = require("../../utils/httpErrors");

const MAX_MESSAGE_LENGTH = 5000;

const addMessage = async (req, res) => {
  try {
    const { message, client_temp_id } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` });
    }

    const request = await findAccessibleRequest(req.user, req.params.id);
    if (!request) return notFound(res);

    const newMessage = await prisma.portalMessage.create({
      data: {
        requestId: request.id,
        userId: req.user.id,
        message,
        isAdmin: isStaff(req.user), // derived from DB role, never from the client
        client_temp_id: typeof client_temp_id === "string" ? client_temp_id.slice(0, 64) : null
      },
      include: {
        user: { select: { name: true, role: true } }
      }
    });

    return res.status(201).json({
      message: "Message added successfully",
      data: newMessage,
    });
  } catch (error) {
    return serverError(res, error, "Failed to add message", req);
  }
};

module.exports = { addMessage };
