const prisma = require("../../config/database/prismaClient");
const { serverError } = require("../../utils/httpErrors");

/** Public: published (ACTIVE) courses only, id + name (used by the registration form). */
const getAllCoursesSimple = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });
    return res.status(200).json(courses);
  } catch (err) {
    return serverError(res, err, "Failed to load courses", req);
  }
};

module.exports = { getAllCoursesSimple };
