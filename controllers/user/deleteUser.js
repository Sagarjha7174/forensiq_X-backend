const prisma = require("../../config/database/prismaClient");
const { canManageUser } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");
const logger = require("../../utils/logger");

/**
 * DELETE /api/v1/user/delete/:id
 * Permanently deletes a user and all related records.
 * Full administrators only; privileged targets require a SUPERADMIN.
 */
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }
    if (!canManageUser(req.user, user)) {
      return res.status(403).json({ error: "You are not allowed to delete this account" });
    }

    // Delete dependent rows in a deterministic order before removing the user.
    await prisma.$transaction(async (tx) => {
      const attempts = await tx.attempt.findMany({ where: { userId: id }, select: { id: true } });
      const attemptIds = attempts.map((attempt) => attempt.id);
      if (attemptIds.length > 0) {
        await tx.questionAttempt.deleteMany({ where: { attemptId: { in: attemptIds } } });
      }

      await tx.couponUse.deleteMany({ where: { userId: id } });
      await tx.payment.deleteMany({ where: { userId: id } });
      await tx.attempt.deleteMany({ where: { userId: id } });
      await tx.enrollment.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { user_id: id } });
      await tx.networkEventRegistration.deleteMany({ where: { user_id: id } });
      await tx.portalMessage.deleteMany({ where: { userId: id } });
      await tx.portalRequest.deleteMany({ where: { userId: id } });
      await tx.coupon.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.coupon.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
      await tx.staffPendingAction.deleteMany({
        where: { OR: [{ submitted_by: id }, { reviewed_by: id }] }
      });
      await tx.user.delete({ where: { id } });
    }, {
      timeout: 30000,
      maxWait: 5000,
    });

    logger.info("User deleted", { requestId: req.id, actorId: req.user?.id, targetId: id });
    return res.json({ message: "User permanently deleted", id });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    if (error.code === "P2003") {
      return res.status(409).json({ error: "Cannot delete user because related records still exist." });
    }
    return serverError(res, error, "Failed to delete user", req);
  }
};

module.exports = { deleteUser };
