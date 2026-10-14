const prisma = require("../../config/database/prismaClient");
const { isStaff } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");
const { COURSE_STATUSES } = require("./courseInput");

const getAllCourses = async (req, res) => {
  try {
    const { status, search, category, sort = 'newest', page = 1, limit = 50 } = req.query;

    const where = {};
    // Visibility: only staff may list unpublished (DRAFT / INACTIVE / ARCHIVED) courses.
    if (!isStaff(req.user)) {
      where.status = "ACTIVE";
    } else if (status) {
      if (!COURSE_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
      where.status = status;
    }
    
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

    const take = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 200);
    const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * take;

    const [total, courses] = await prisma.$transaction([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        orderBy,
        skip,
        take,
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
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (err) {
    return serverError(res, err, "Failed to load courses", req);
  }
};

module.exports = { getAllCourses };
