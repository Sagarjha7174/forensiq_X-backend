const prisma = require("../../config/database/prismaClient");

const getAllCourses = async (req, res) => {
  try {
    const { status, search, category, sort = 'newest', page = 1, limit = 50 } = req.query;

    const where = {};
    if (status) where.status = status;
    
    // Category could match class or degree in this schema
    if (category) {
      where.OR = [
        { class: category },
        { degree: category }
      ];
    }

    if (search) {
      const searchOr = [
        { name: { contains: search } },
        { description: { contains: search } },
        { teacher: { contains: search } }
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    let orderBy = { createdAt: 'desc' };
    if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    else if (sort === 'name-asc') orderBy = { name: 'asc' };
    else if (sort === 'name-desc') orderBy = { name: 'desc' };

    const skip = (Number(page) - 1) * Number(limit);

    const [total, courses] = await prisma.$transaction([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        orderBy,
        skip,
        take: Number(limit),
        include: {
          quizess: true,
          _count: {
            select: { 
              enrollments: { where: { status: 'ACTIVE' } },
              modules: true
            }
          }
        },
      })
    ]);

    const formattedCourses = courses.map(course => ({
      ...course,
      studentsEnrolled: course._count.enrollments,
      modulesCount: course._count.modules,
      _count: undefined
    }));

    res.status(200).json({
      data: formattedCourses,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getAllCourses };
