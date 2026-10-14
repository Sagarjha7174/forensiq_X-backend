const prisma = require("../../config/database/prismaClient");
const { canAccessOwnedResource } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");


const getCourseByUser = async (req, res) => {
  const { userId } = req.params;

  // Owner or staff only: this response contains paid content links (notes URLs).
  if (!canAccessOwnedResource(req.user, userId)) {
    return res.status(404).json({ error: "User not found" });
  }


  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        enrollments: {
          where: {
            status: "ACTIVE",
            course: {
              status: { in: ["ACTIVE", "INACTIVE", "DRAFT"] }
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
    return serverError(res, err, "Internal server error", req);
  }
};

module.exports = { getCourseByUser };


