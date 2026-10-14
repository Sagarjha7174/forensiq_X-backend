const { handleControllerError } = require("../../utils/httpErrors");
const prisma = require("../../config/database/prismaClient");

const getAllNotice = async (req, res) => {
    try {
        const notices = await prisma.notice.findMany();
        res.status(200).json(notices);
    } catch (err) {
        return handleControllerError(res, err, req);
    }
};

module.exports = { getAllNotice };