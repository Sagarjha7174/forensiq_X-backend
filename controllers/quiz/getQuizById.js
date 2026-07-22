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
        course: {
          select: { id: true, status: true }
        },
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

    // Admin bypass
    if (req.user && (req.user.role === "ADMIN" || req.user.role === "SUPERADMIN")) {
      return res.status(200).json(quiz);
    }

    // Enrollment check for students
    let hasAccess = false;
    for (const course of quiz.course) {
      if (course.status !== 'ACTIVE') continue;
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: course.id
          }
        }
      });
      if (enrollment && enrollment.status === 'ACTIVE') {
        hasAccess = true;
        break;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You do not have an active enrollment for the course containing this quiz." });
    }

    // Optional: remove the 'course' array from the response to keep the payload clean
    delete quiz.course;

    // Strip answers from questions for non-admins
    if (!req.user || (req.user.role !== "ADMIN" && req.user.role !== "SUPERADMIN")) {
      quiz.questions = quiz.questions.map(q => {
        const { answer, ...qWithoutAnswer } = q;
        return qWithoutAnswer;
      });
    }

    res.status(200).json(quiz);
  } catch (err) {
    console.error("Error fetching quiz:", err);
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getQuizById };
