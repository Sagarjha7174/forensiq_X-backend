const prisma = require("../../config/database/prismaClient");
const { serverError } = require("../../utils/httpErrors");

const deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    await prisma.course.delete({ where: { id: courseId } });
    return res.status(200).json({ message: "Course deleted successfully" });
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Course has payments or other records and cannot be deleted. Archive it instead." });
    }
    return serverError(res, err, "Failed to delete course", req);
  }
};

module.exports = { deleteCourse };
