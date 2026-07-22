const prisma = require("../../config/database/prismaClient");

const submitQuiz = async (req, res) => {
  const { quizId, answers } = req.body;
  const userId = req.user.id;

  if (!quizId || !answers || typeof answers !== 'object') {
    return res.status(400).json({ error: "Invalid payload. Requires quizId and answers object." });
  }

  try {
    // 1. Fetch the quiz and true answers
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          select: { id: true, answer: true }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // 2. Evaluate answers
    let score = 0;
    const questionAttemptsData = [];

    for (const question of quiz.questions) {
      const userAnswer = answers[question.id] || null;
      const isCorrect = userAnswer === question.answer;

      if (isCorrect) {
        score += 1;
      }

      questionAttemptsData.push({
        questionId: question.id,
        answer: userAnswer || "",
        isCorrect: isCorrect
      });
    }

    // 3. Save attempt and question attempts inside a transaction
    const attempt = await prisma.$transaction(async (tx) => {
      const newAttempt = await tx.attempt.create({
        data: {
          userId,
          quizId,
          score,
          questionAttempts: {
            create: questionAttemptsData
          }
        },
        include: {
          questionAttempts: true
        }
      });
      return newAttempt;
    });

    res.status(200).json({
      message: "Quiz submitted successfully",
      attemptId: attempt.id,
      score: attempt.score,
      total: quiz.queCount,
      percentage: (attempt.score / quiz.queCount) * 100
    });

  } catch (error) {
    console.error("Error submitting quiz:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { submitQuiz };
