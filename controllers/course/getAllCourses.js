const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAllCourses = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        quizess: true,
      },
    });
    res.status(200).json(courses);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getAllCourses };
