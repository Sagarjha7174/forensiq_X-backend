const prisma = require("../../config/database/prismaClient");

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
    if (attempt.userId !== userId && req.user.role !== "ADMIN" && req.user.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Forbidden: You cannot view someone else's attempt." });
    }

    res.status(200).json(attempt);
  } catch (error) {
    console.error("Error fetching attempt result:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getAttemptResult };
