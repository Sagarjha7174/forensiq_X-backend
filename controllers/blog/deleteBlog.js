const prisma = require("../../config/database/prismaClient");

const deleteBlog = async (req, res) => {
    const blogId = req.params.id;

    const blog = await prisma.blog.findUnique({
        where: { id: blogId },
    });

    if (!blog) {
        return res.status(404).json({ error: "Blog not found" });
    }

    try {
        await prisma.blog.delete({
            where: { id: blogId },
        });

        res.status(200).json({ message: "Blog deleted successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { deleteBlog };
