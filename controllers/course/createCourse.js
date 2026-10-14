const prisma = require("../../config/database/prismaClient");
const { parseCourseInput } = require("./courseInput");
const { serverError } = require("../../utils/httpErrors");

const createCourse = async (req, res) => {
  try {
    const input = parseCourseInput(req.body);
    if (!input.name || !input.description) {
      return res.status(400).json({ error: "name and description are required" });
    }

    const course = await prisma.course.create({
      data: {
        name: input.name,
        description: input.description,
        class: input.class,
        teacher: input.teacher,
        degree: input.degree,
        videoUrl: input.videoUrl,
        imageUrl: input.imageUrl,
        price: input.price ?? 0,
        ...(input.status ? { status: input.status } : {}),
      },
    });

    return res.status(201).json(course);
  } catch (err) {
    return serverError(res, err, "Failed to create course", req);
  }
};

module.exports = { createCourse };
