const prisma = require("../../config/database/prismaClient");
const { isStaff } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");

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
    return serverError(res, error, "Internal server error", req);
  }
};

module.exports = { getQuizAttempts };
