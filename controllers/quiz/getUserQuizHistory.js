const prisma = require("../../config/database/prismaClient");
const { isStaff } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");

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
    return serverError(res, error, "Internal server error", req);
  }
};

module.exports = { getUserQuizHistory };
