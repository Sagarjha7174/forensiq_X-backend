const prisma = require("../../config/database/prismaClient");

const getAllCoursesSimple = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    res.status(200).json(courses);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getAllCoursesSimple };
