const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAllNotes = async (req, res) => {
    try {
        const notes = await prisma.notes.findMany({
            include: {
                course: true,
            },
        });
        res.status(200).json(notes);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { getAllNotes };