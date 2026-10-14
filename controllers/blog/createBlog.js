const { safeUrl } = require("../../utils/sanitize");
const { handleControllerError } = require("../../utils/httpErrors");
const prisma = require("../../config/database/prismaClient");

const createBlog = async (req, res) => {
    const { title, content, author } = req.body;
    let imageUrl;
    try { imageUrl = safeUrl(req.body.imageUrl, "imageUrl") || null; } catch (e) { return res.status(400).json({ error: e.message }); }

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
        return handleControllerError(res, err, req);
    }
};

module.exports = { createBlog };
