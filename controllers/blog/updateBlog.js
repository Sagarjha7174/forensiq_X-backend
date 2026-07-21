const prisma = require("../../config/database/prismaClient");

const updateBlog = async (req, res) => {
    const { id } = req.params;
    const { title, content, author, imageUrl } = req.body;

    try {
        // Check if blog exists
        const blogExists = await prisma.blog.findUnique({
            where: { id },
        });

        if (!blogExists) {
            return res.status(404).json({ error: "Blog not found" });
        }

        // Update blog
        const updatedBlog = await prisma.blog.update({
            where: { id },
            data: {
                ...(title && { title }),
                ...(content && { content }),
                ...(author && { author }),
                ...(imageUrl !== undefined && { imageUrl }),
            },
        });

        res.status(200).json(updatedBlog);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { updateBlog };
