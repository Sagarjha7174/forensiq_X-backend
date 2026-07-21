const prisma = require("../../config/database/prismaClient");

const createNotice = async (req, res) => {
    const {title,description,fileUrl} = req.body;
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
        res.status(400).json({ error: err.message });
    }};

module.exports = { createNotice };       