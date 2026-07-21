const prisma = require("../../config/database/prismaClient");

const deleteNotes = async (req, res) => {
    const notesId = req.params.id;
    const notes = await prisma.notes.findUnique({
        where: {
            id: notesId
        }
    });
    if (!notes) {
        return res.status(404).json({ error: "Notes not found" });
    }
    try {
        await prisma.notes.delete({
            where: {
                id: notesId
            }
        });
        res.status(200).json({ message: "Notes deleted successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { deleteNotes };