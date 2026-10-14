const prisma = require("../config/database/prismaClient");
const { isStaff } = require("./roles");

const REQUEST_STATUSES = Object.freeze([
  "submitted", "pending", "under_review", "in_progress", "scheduled", "meeting_scheduled",
  "confirmed", "approved", "completed", "rejected", "cancelled",
]);

/**
 * Load a portal request only if `user` may access it (owner or staff).
 * Returns null for both "does not exist" and "not yours" so callers respond 404
 * without revealing which ids exist.
 */
async function findAccessibleRequest(user, requestId, include) {
  if (!user || typeof requestId !== "string" || requestId.length > 64) return null;
  const request = await prisma.portalRequest.findUnique({
    where: { id: requestId },
    ...(include ? { include } : {}),
  });
  if (!request) return null;
  if (request.userId !== user.id && !isStaff(user)) return null;
  return request;
}

const notFound = (res) => res.status(404).json({ error: "Request not found" });

module.exports = { findAccessibleRequest, notFound, REQUEST_STATUSES, isStaff };
