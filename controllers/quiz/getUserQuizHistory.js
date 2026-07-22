const prisma = require("../../config/database/prismaClient");

const getUserQuizHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const attempts = await prisma.attempt.findMany({
      where: {
        userId
      },
      include: {
        quiz: {
          select: { name: true, passMark: true, queCount: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(attempts);
  } catch (error) {
    console.error("Error fetching user quiz history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getUserQuizHistory };
