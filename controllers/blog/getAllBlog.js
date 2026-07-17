const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAllBlogs = async (req, res) => {
    try {
        const blogs = await prisma.blog.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });

        res.status(200).json(blogs);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { getAllBlogs };
