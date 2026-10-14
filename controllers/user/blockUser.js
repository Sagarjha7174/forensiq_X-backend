const prisma = require("../../config/database/prismaClient");
const { canManageUser } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");

const blockUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!canManageUser(req.user, user)) {
      return res.status(403).json({ error: 'You are not allowed to block this account' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: false, accountStatus: 'BLOCKED' },
    });

    return res.status(200).json({
      message: `User ${updatedUser.name} has been blocked.`,
      isActive: updatedUser.isActive,
    });
  } catch (error) {
    return serverError(res, error, 'An error occurred while blocking the user.', req);
  }
};

module.exports = { blockUser };
