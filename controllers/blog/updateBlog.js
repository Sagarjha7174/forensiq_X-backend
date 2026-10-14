const { safeUrl } = require("../../utils/sanitize");
const { handleControllerError } = require("../../utils/httpErrors");
const prisma = require("../../config/database/prismaClient");

const updateBlog = async (req, res) => {
    const { id } = req.params;
    const { title, content, author } = req.body;
    let imageUrl;
    try { imageUrl = req.body.imageUrl === undefined ? undefined : (safeUrl(req.body.imageUrl, "imageUrl") || null); } catch (e) { return res.status(400).json({ error: e.message }); }

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
        return handleControllerError(res, err, req);
    }
};

module.exports = { updateBlog };
