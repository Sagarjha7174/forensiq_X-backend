const prisma = require("../../config/database/prismaClient");

const updateNotes = async (req, res) => {
    const { id } = req.params;
    const { courseId, title, description, url } = req.body;

    try {
        // Check if notes exists
        const notesExists = await prisma.notes.findUnique({
            where: { id }
        });

        if (!notesExists) {
            return res.status(404).json({ error: "Notes not found" });
        }

        // Update notes
        const updatedNotes = await prisma.notes.update({
            where: { id },
            data: {
                ...(courseId && { courseId }),
                ...(title && { title }),
                ...(description !== undefined && { description }),
                ...(url !== undefined && { url })
            }
        });

        res.status(200).json(updatedNotes);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { updateNotes };
