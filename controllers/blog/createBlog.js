const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const createBlog = async (req, res) => {
    const { title, content, author, imageUrl } = req.body;

    // Basic validation (optional but recommended)
    if (!title || !content || !author) {
        return res.status(400).json({
            error: "title, content and author are required"
        });
    }

    try {
        const blog = await prisma.blog.create({
            data: {
                title,
                content,
                author,
                imageUrl: imageUrl ?? null, // handles undefined safely
            },
        });

        res.status(201).json(blog);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { createBlog };
