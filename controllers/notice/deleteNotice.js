const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const deleteNotice = async (req, res) => {
    const { noticeId } = req.params;
    try {
        const deletedNotice = await prisma.notice.delete({
            where: {
                id: noticeId

            }
        });
        res.status(200).json(deletedNotice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { deleteNotice };