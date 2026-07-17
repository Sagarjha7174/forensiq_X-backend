const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const updateNotice = async (req, res) => {
    const noticeId = req.params.noticeId;

    if (!noticeId) {
        return res.status(400).json({ error: "Notice ID is required" });
    }

    try {
        // 1. Check if notice exists
        const notice = await prisma.notice.findUnique({
            where: {
                id: noticeId
            }
        });

        if (!notice) {
            return res.status(404).json({ error: "Notice not found" });
        }

        // 2. Extract fields from request body
        const { title, description, fileUrl } = req.body;

        // 3. Update notice with fallback values
        const updatedNotice = await prisma.notice.update({
            where: {
                id: noticeId
            },
            data: {
                title: title || notice.title,
                description: description || notice.description,
                fileUrl: fileUrl || notice.fileUrl
            }
        });

        res.status(200).json(updatedNotice);

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { updateNotice };
