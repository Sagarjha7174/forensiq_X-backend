const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const deleteCourse = async (req, res) => {
    const courseId = req.params.id;
    const course = await prisma.course.findUnique({
        where: {
            id: courseId
        }
    });
    if (!course) {
        return res.status(404).json({ error: "Course not found" });
    }
    try {
        await prisma.course.delete({
            where: {
                id: courseId
            }
        });
        res.status(200).json({ message: "Course deleted successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { deleteCourse };