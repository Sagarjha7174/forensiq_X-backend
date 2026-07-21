const prisma = require("../../config/database/prismaClient");

const getAllEnrollments = async (req, res) => {
  try {
    const { courseId, userId, status } = req.query;

    const where = {};
    if (courseId) where.courseId = courseId;
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, profile_image: true, accountStatus: true }
        },
        course: {
          select: { id: true, name: true, status: true }
        }
      },
      orderBy: { enrolledAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: enrollments
    });
  } catch (err) {
    console.error("Get all enrollments error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getAllEnrollments };
