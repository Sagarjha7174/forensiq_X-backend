const prisma = require("../../config/database/prismaClient");
const { isStaff } = require("../../utils/roles");
const { hasQuizAccess, verifyAttemptToken, sanitizeAnswers } = require("../../services/quizAccess");
const { serverError } = require("../../utils/httpErrors");

/**
 * POST /quiz/submit  { quizId, answers: { [questionId]: "OPTION A".."OPTION D" }, attemptToken }
 *
 * - eligibility: active enrollment in an active course containing the quiz (staff exempt)
 * - attemptToken (issued by GET /quiz/get/:quizId) enforces the time limit and makes each
 *   started attempt submittable exactly once (duplicate / replayed submissions get 409)
 * - score is always computed on the server
 */
const submitQuiz = async (req, res) => {
  const { quizId, answers, attemptToken } = req.body || {};
  const userId = req.user.id;

  if (typeof quizId !== "string" || !quizId || !answers || typeof answers !== "object" || Array.isArray(answers)) {
    return res.status(400).json({ error: "Invalid payload. Requires quizId and answers object." });
  }

  try {
    const { quiz: meta, allowed } = await hasQuizAccess(req.user, quizId);
    if (!meta) return res.status(404).json({ error: "Quiz not found" });
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden: You do not have an active enrollment for the course containing this quiz." });
    }

    const staff = isStaff(req.user);
    const attempt = staff ? null : verifyAttemptToken(attemptToken, userId, quizId);
    if (!staff && !attempt) {
      return res.status(403).json({ error: "This quiz session has expired or is invalid. Please restart the quiz." });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { select: { id: true, answer: true } } }
    });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });

    const cleanAnswers = sanitizeAnswers(answers, quiz.questions.map((q) => q.id));

    let score = 0;
    const questionAttemptsData = quiz.questions.map((question) => {
      const userAnswer = cleanAnswers[question.id] || null;
      const isCorrect = userAnswer !== null && userAnswer === question.answer;
      if (isCorrect) score += 1;
      return { questionId: question.id, answer: userAnswer || "", isCorrect };
    });

    const created = await prisma.$transaction(async (tx) => {
      // Serialize submissions for this user+quiz so concurrent duplicates cannot both pass.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`quiz:${userId}:${quizId}`}))`;

      if (attempt) {
        const already = await tx.attempt.findFirst({
          where: { userId, quizId, createdAt: { gte: new Date(attempt.startedAt) } },
          select: { id: true },
        });
        if (already) return null;
      }

      return tx.attempt.create({
        data: {
          userId,
          quizId,
          score,
          questionAttempts: { create: questionAttemptsData }
        },
      });
    });

    if (!created) {
      return res.status(409).json({ error: "This attempt has already been submitted." });
    }

    const total = quiz.queCount || quiz.questions.length || 0;
    return res.status(200).json({
      message: "Quiz submitted successfully",
      attemptId: created.id,
      score: created.score,
      total,
      percentage: total ? (created.score / total) * 100 : 0
    });
  } catch (error) {
    return serverError(res, error, "Internal server error", req);
  }
};

module.exports = { submitQuiz };
