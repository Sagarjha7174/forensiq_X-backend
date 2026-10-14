const prisma = require("../../config/database/prismaClient");
const { parseCourseInput } = require("./courseInput");
const { serverError } = require("../../utils/httpErrors");

const updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const input = parseCourseInput(req.body);

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        name: input.name || course.name,
        description: input.description || course.description,
        class: input.class || course.class,
        teacher: input.teacher || course.teacher,
        degree: input.degree || course.degree,
        videoUrl: input.videoUrl || course.videoUrl,
        imageUrl: input.imageUrl || course.imageUrl,
        price: input.price !== undefined ? input.price : course.price,
        status: input.status || course.status,
      },
    });

    return res.status(201).json(updatedCourse);
  } catch (err) {
    return serverError(res, err, "Failed to update course", req);
  }
};

module.exports = { updateCourse };
