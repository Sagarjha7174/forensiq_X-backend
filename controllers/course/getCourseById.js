const prisma = require("../../config/database/prismaClient");
const { isStaff } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");

/**
 * Course details. Staff see any course; others see ACTIVE courses, or a non-active
 * course they are enrolled in (so existing students keep seeing what they bought).
 */
const getCourseById = async (req, res) => {
  const { id } = req.params;

  try {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.status !== "ACTIVE" && !isStaff(req.user)) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: req.user.id, courseId: id } },
        select: { id: true },
      });
      if (!enrollment) return res.status(404).json({ error: "Course not found" });
    }

    return res.status(200).json(course);
  } catch (err) {
    return serverError(res, err, "Failed to load course", req);
  }
};

module.exports = { getCourseById };
