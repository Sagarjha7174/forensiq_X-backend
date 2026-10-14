const { safeUrl } = require("../../utils/sanitize");
const { handleControllerError } = require("../../utils/httpErrors");
const prisma = require("../../config/database/prismaClient");

const createNotes = async (req, res) => {
    const { courseId, title, description } = req.body;
    let url;
    try { url = safeUrl(req.body.url, "url"); } catch (e) { return res.status(400).json({ error: e.message }); }
    try {
        const notes = await prisma.notes.create({
        data: {
            courseId, // Ensure courseId is an integer
            title,
            description,
            url: url,
        },
        });
        res.status(201).json(notes);
    } catch (err) {
        return handleControllerError(res, err, req);
    }
    };

    module.exports = { createNotes };