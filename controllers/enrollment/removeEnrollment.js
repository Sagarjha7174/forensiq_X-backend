const prisma = require("../../config/database/prismaClient");
const { serverError } = require("../../utils/httpErrors");

const removeEnrollment = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await prisma.enrollment.findUnique({ where: { id } });
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    // Optionally delete the payment record if it was a MANUAL or ADMIN assignment
    if (enrollment.paymentId && (enrollment.source === 'MANUAL' || enrollment.source === 'ADMIN')) {
      try {
        await prisma.payment.delete({ where: { id: enrollment.paymentId } });
      } catch (err) {
        console.error("Could not delete associated payment:", err);
      }
    }

    await prisma.enrollment.delete({ where: { id } });

    res.status(200).json({ message: "Enrollment removed successfully" });
  } catch (err) {
    return serverError(res, err, "Internal server error", req);
  }
};

module.exports = { removeEnrollment };
