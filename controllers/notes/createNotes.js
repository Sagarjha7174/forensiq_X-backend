const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const createNotes = async (req, res) => {
    const { courseId, title, description, url } = req.body;
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
        res.status(400).json({ error: err.message });
    }
    };

    module.exports = { createNotes };