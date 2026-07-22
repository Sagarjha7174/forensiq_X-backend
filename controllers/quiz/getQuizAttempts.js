const prisma = require("../../config/database/prismaClient");

const getQuizAttempts = async (req, res) => {
  const { quizId } = req.params;
  const userId = req.user.id;

  try {
    const attempts = await prisma.attempt.findMany({
      where: {
        userId,
        quizId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(attempts);
  } catch (error) {
    console.error("Error fetching quiz attempts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getQuizAttempts };
