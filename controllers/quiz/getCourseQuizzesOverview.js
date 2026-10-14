const prisma = require("../../config/database/prismaClient");
const { isStaff } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");

const getCourseQuizzesOverview = async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  try {
    // Check enrollment first
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId
        }
      }
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      if (!isStaff(req.user)) {
        return res.status(403).json({ error: "Forbidden: You are not enrolled in this course." });
      }
    }

    const quizzes = await prisma.quiz.findMany({
      where: {
        course: {
          some: { id: courseId }
        }
      },
      select: {
        id: true,
        name: true,
        duration: true,
        queCount: true,
        total: true,
        passMark: true,
        attempts: {
          where: { userId },
          select: { score: true, createdAt: true }
        }
      }
    });

    const overview = quizzes.map(quiz => {
      const userAttempts = quiz.attempts || [];
      const attemptsCount = userAttempts.length;
      let bestScore = 0;
      let lastAttemptScore = 0;
      let lastAttemptDate = null;

      if (attemptsCount > 0) {
        // Find best score
        bestScore = Math.max(...userAttempts.map(a => a.score));
        
        // Find last attempt
        const sortedAttempts = [...userAttempts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        lastAttemptScore = sortedAttempts[0].score;
        lastAttemptDate = sortedAttempts[0].createdAt;
      }

      return {
        id: quiz.id,
        name: quiz.name,
        duration: quiz.duration,
        queCount: quiz.queCount,
        total: quiz.total,
        passMark: quiz.passMark,
        stats: {
          attemptsCount,
          bestScore,
          lastAttemptScore,
          lastAttemptDate
        }
      };
    });

    res.status(200).json(overview);
  } catch (error) {
    return serverError(res, error, "Internal server error", req);
  }
};

module.exports = { getCourseQuizzesOverview };
