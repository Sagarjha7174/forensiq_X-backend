const prisma = require("../../config/database/prismaClient");

/**
 * DELETE /api/v1/user/delete/:id
 * Permanently deletes a user and all related records.
 * Admin only.
 */
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent self-deletion
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    // Delete in correct order to respect foreign key constraints
    await prisma.$transaction([
      prisma.couponUse.deleteMany({ where: { userId: id } }),
      prisma.payment.deleteMany({ where: { userId: id } }),
      prisma.attempt.deleteMany({ where: { userId: id } }),
      prisma.enrollment.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.networkEventRegistration.deleteMany({ where: { userId: id } }),
      prisma.portalMessage.deleteMany({ where: { userId: id } }),
      prisma.portalRequest.deleteMany({ where: { userId: id } }),
      prisma.coupon.updateMany({
        where: { createdById: id },
        data: { createdById: null },
      }),
      prisma.coupon.updateMany({
        where: { updatedById: id },
        data: { updatedById: null },
      }),
      prisma.staffPendingAction.deleteMany({
        where: { OR: [{ submitted_by: id }, { reviewed_by: id }] }
      }),
      prisma.user.delete({ where: { id } }),
    ]);

    return res.json({ message: "User permanently deleted", id });
  } catch (error) {
    console.error("[DELETE USER] Error:", error.message);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(500).json({ error: "Failed to delete user", details: error.message });
  }
};

module.exports = { deleteUser };
