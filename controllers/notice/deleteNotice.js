const { handleControllerError } = require("../../utils/httpErrors");
const prisma = require("../../config/database/prismaClient");
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
        return handleControllerError(res, err, req);
    }
};

module.exports = { deleteNotice };