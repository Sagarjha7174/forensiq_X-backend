const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const createCourse = async (req, res) => {
  const {
    name,
    description,
    courseClass,
    teacher,
    degree,
    videoUrl,
    imageUrl,
    price,
  } = req.body;
  try {
    const course = await prisma.course.create({
      data: {
        name,
        description,
        class: courseClass,
        teacher,
        degree,
        videoUrl,
        imageUrl,
        price,
      },
    });
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { createCourse };