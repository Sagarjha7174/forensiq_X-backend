const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const updateEnrollmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const enrollment = await prisma.enrollment.findUnique({ where: { id } });
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    const updated = await prisma.enrollment.update({
      where: { id },
      data: { 
        status,
        activatedAt: status === 'ACTIVE' ? new Date() : enrollment.activatedAt
      }
    });

    res.status(200).json({
      message: `Enrollment status updated to ${status}`,
      enrollment: updated
    });
  } catch (err) {
    console.error("Update enrollment status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { updateEnrollmentStatus };
