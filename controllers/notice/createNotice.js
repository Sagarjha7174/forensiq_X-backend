const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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