const prisma = require("../../config/database/prismaClient");

const getAllNotice = async (req, res) => {
    try {
        const notices = await prisma.notice.findMany();
        res.status(200).json(notices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAllNotice };