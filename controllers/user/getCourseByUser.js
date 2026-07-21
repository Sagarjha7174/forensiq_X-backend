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
              status: "ACTIVE"
            }
          },
          include: {
            course: {
              include: {
                quizess: true,
                notes: true
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
    const courses = user.enrollments.map(enrollment => enrollment.course);

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


