const prisma = require("../../config/database/prismaClient");


const getCourseByUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        enrollments: {
          where: {
            status: "ACTIVE",
            course: {
              status: { in: ["ACTIVE", "INACTIVE"] }
            }
          },
          include: {
            course: {
              include: {
                quizess: true,
                notes: true,
                _count: { select: { modules: true } }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Transform response to return courses directly
    const courses = user.enrollments.map(enrollment => {
      const course = enrollment.course;
      return {
        ...course,
        modulesCount: course._count?.modules,
        _count: undefined
      };
    });

    res.status(200).json({
      userId: user.id,
      courses
    });
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getCourseByUser };


