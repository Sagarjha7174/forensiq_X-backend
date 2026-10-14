const { safeUrl } = require("../../utils/sanitize");
const { handleControllerError } = require("../../utils/httpErrors");
const prisma = require("../../config/database/prismaClient");

const createNotice = async (req, res) => {
    const { title, description } = req.body;
    let fileUrl;
    try { fileUrl = safeUrl(req.body.fileUrl, "fileUrl"); } catch (e) { return res.status(400).json({ error: e.message }); }
    try {
        const notice = await prisma.notice.create({ 
            data: {
                title,
                description,
                fileUrl
            }
        });
        res.status(201).json(notice);
    } catch (err) {
        return handleControllerError(res, err, req);
    }};

module.exports = { createNotice };       