const { handleControllerError } = require("../../utils/httpErrors");
const prisma = require("../../config/database/prismaClient");

const getAllBlogs = async (req, res) => {
    try {
        const blogs = await prisma.blog.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });

        res.status(200).json(blogs);
    } catch (err) {
        return handleControllerError(res, err, req);
    }
};

module.exports = { getAllBlogs };
