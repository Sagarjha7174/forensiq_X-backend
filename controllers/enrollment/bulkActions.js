const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const bulkEnrollmentAction = async (req, res) => {
  try {
    const { enrollmentIds, action } = req.body; // action can be 'SUSPEND' or 'REMOVE'

    if (!enrollmentIds || !Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
      return res.status(400).json({ error: "No enrollments selected" });
    }

    if (action === 'SUSPEND') {
      await prisma.enrollment.updateMany({
        where: { id: { in: enrollmentIds } },
        data: { status: 'INACTIVE' },
      });
      return res.status(200).json({ message: `${enrollmentIds.length} enrollments suspended successfully` });
    } 
    
    if (action === 'REMOVE') {
      // Find all enrollments to check their paymentIds and sources
      const enrollments = await prisma.enrollment.findMany({
        where: { id: { in: enrollmentIds } },
        select: { id: true, paymentId: true, source: true },
      });

      // Collect payment IDs that were manually assigned so we can clean them up
      const paymentIdsToDelete = enrollments
        .filter(e => e.paymentId && (e.source === 'MANUAL' || e.source === 'ADMIN'))
        .map(e => e.paymentId);

      // We can run these operations in sequence or transaction. Sequence is fine since they are independent enough.
      if (paymentIdsToDelete.length > 0) {
        try {
          await prisma.payment.deleteMany({
            where: { id: { in: paymentIdsToDelete } }
          });
        } catch (err) {
          console.error("Could not delete some associated payments during bulk remove:", err);
          // Non-fatal, proceed to delete enrollments
        }
      }

      await prisma.enrollment.deleteMany({
        where: { id: { in: enrollmentIds } },
      });

      return res.status(200).json({ message: `${enrollmentIds.length} enrollments removed successfully` });
    }

    return res.status(400).json({ error: "Invalid action" });

  } catch (error) {
    console.error("Error in bulk enrollment action:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { bulkEnrollmentAction };
