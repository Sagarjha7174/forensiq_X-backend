const { handleControllerError } = require("../../utils/httpErrors");
const prisma = require("../../config/database/prismaClient");

const getAllNotes = async (req, res) => {
    try {
        const notes = await prisma.notes.findMany({
            include: {
                course: true,
            },
        });
        res.status(200).json(notes);
    } catch (err) {
        return handleControllerError(res, err, req);
    }
};

module.exports = { getAllNotes };