
const prisma = require("../../config/database/prismaClient");
const { toSafeUser } = require("../../utils/userSerializer");
const { serverError } = require("../../utils/httpErrors");


exports.getAllUser = async (req, res) => {
  try {
    const { role, accountStatus, isVerified, search, sort = 'newest', page = 1, limit = 10000 } = req.query;

    // Allow limit=all as a shorthand for no limit
    const effectiveLimit = limit === 'all' ? 100000 : Math.min(Math.max(Number(limit) || 50, 1), 100000);

    const where = {};
    if (role) where.role = role;
    if (accountStatus) where.accountStatus = accountStatus;
    if (isVerified !== undefined) where.isVerified = isVerified === 'true';

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    else if (sort === 'name-asc') orderBy = { name: 'asc' };
    else if (sort === 'name-desc') orderBy = { name: 'desc' };

    const skip = (Number(page) - 1) * effectiveLimit;

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: effectiveLimit,
        include: {
          enrollments: {
            where: { status: 'ACTIVE' },
            include: { course: true }
          }
        }
      })
    ]);

    const formattedUsers = users.map(user => ({
      ...toSafeUser(user),
      courses: user.enrollments.map(e => e.course),
      enrollments: undefined
    }));

    res.json({
      data: formattedUsers,
      meta: {
        total,
        page: Number(page),
        limit: effectiveLimit,
        totalPages: Math.ceil(total / effectiveLimit)
      }
    });
  } catch (error) {
    return serverError(res, error, "Internal server error", req);
  }
};
