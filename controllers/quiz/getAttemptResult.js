const prisma = require("../../config/database/prismaClient");
const { isStaff } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");

const getAttemptResult = async (req, res) => {
  const { attemptId } = req.params;
  const userId = req.user.id;

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          select: { name: true, duration: true, passMark: true, total: true, queCount: true }
        },
        questionAttempts: {
          include: {
            question: {
              select: { id: true, question: true, options: true, answer: true, image: true }
            }
          }
        }
      }
    });

    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    // Authorization check
    if (attempt.userId !== userId && !isStaff(req.user)) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    res.status(200).json(attempt);
  } catch (error) {
    return serverError(res, error, "Internal server error", req);
  }
};

module.exports = { getAttemptResult };
