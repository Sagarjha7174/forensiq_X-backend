const prisma = require("../../config/database/prismaClient");

const getCourseById = async (req, res) => {
  const { id } = req.params;
  try {
    const course = await prisma.course.findUnique({
      where: {
        id: id,
      },
    });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.status(200).json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getCourseById };
