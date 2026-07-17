const prisma = require("../../config/database/prismaClient");

const getQuizById = async (req, res) => {
  const { quizId } = req.params;

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        name: true,
        duration: true,
        queCount: true,
        total: true,
        passMark: true,
        questions: {
          select: {
            id: true,
            question: true,
            options: true,
            image: true,
            answer:true
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.status(200).json(quiz);
  } catch (err) {
    console.error("Error fetching quiz:", err);
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getQuizById };
