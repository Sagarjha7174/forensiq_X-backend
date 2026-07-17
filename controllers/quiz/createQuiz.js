const prisma = require("../../config/database/prismaClient");

const VALID_OPTIONS = ["OPTION A", "OPTION B", "OPTION C", "OPTION D"];

const createQuiz = async (req, res) => {
  const { name, questions, passMark, total, duration } = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "Questions are required" });
  }

  // 🔒 Validate questions
  for (const q of questions) {
    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
      return res.status(400).json({ error: "Invalid question format" });
    }

    const optionValues = q.options.map((o) => o.value);

    if (!VALID_OPTIONS.every((v) => optionValues.includes(v))) {
      return res.status(400).json({
        error: "Options must contain OPTION A, OPTION B, OPTION C, OPTION D",
      });
    }

    if (!VALID_OPTIONS.includes(q.answer)) {
      return res.status(400).json({
        error: "Answer must be OPTION A/B/C/D",
      });
    }

    if (!optionValues.includes(q.answer)) {
      return res.status(400).json({
        error: "Answer must exist in options",
      });
    }
  }

  try {
    const quiz = await prisma.$transaction(
      async (tx) => {
        const quiz = await tx.quiz.create({
          data: {
            name,
            queCount: questions.length,
            passMark,
            total,
            duration,
          },
        });

        await Promise.all(
          questions.map((q) =>
            tx.question.create({
              data: {
                question: q.question,
                options: q.options,
                answer: q.answer,
                quizess: { connect: { id: quiz.id } },
              },
            }),
          ),
        );

        return quiz;
      },
      {
        // ⏳ max time Prisma waits to start transaction
        timeout: 120000, // ⏱️ max time transaction can run
      },
    );

    res.status(201).json({
      message: "Quiz created successfully",
      quizId: quiz.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating quiz" });
  }
};

module.exports = { createQuiz };
