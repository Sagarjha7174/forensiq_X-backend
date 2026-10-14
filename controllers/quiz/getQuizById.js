const prisma = require("../../config/database/prismaClient");
const { isStaff } = require("../../utils/roles");
const { hasQuizAccess, issueAttemptToken } = require("../../services/quizAccess");
const { serverError } = require("../../utils/httpErrors");

const getQuizById = async (req, res) => {
  const { quizId } = req.params;

  try {
    const { quiz: meta, allowed } = await hasQuizAccess(req.user, quizId);
    if (!meta) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden: You do not have an active enrollment for the course containing this quiz." });
    }

    const staff = isStaff(req.user);
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
            // Answer keys only ever leave the server for staff.
            answer: staff,
          }
        }
      }
    });

    if (!staff) {
      // Belt and braces: never let an answer key through for students, whatever the query returned.
      quiz.questions = (quiz.questions || []).map(({ answer, ...question }) => question);
      quiz.attemptToken = issueAttemptToken(req.user.id, meta);
    }

    return res.status(200).json(quiz);
  } catch (err) {
    return serverError(res, err, "Failed to load quiz", req);
  }
};

module.exports = { getQuizById };
