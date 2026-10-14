const prisma = require("../config/database/prismaClient");
const { isStaff } = require("../utils/roles");
const { serverError } = require("../utils/httpErrors");

/**
 * Returns null when `user` may access paid content of `courseId`, otherwise
 * `{ status, error }` describing why not. Staff always have access.
 */
async function getCourseAccessDenial(user, courseId) {
  if (!user) return { status: 401, error: "Unauthorized" };
  if (!courseId || typeof courseId !== "string") {
    return { status: 400, error: "courseId is required for authorization" };
  }
  if (isStaff(user)) return null;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    include: { course: { select: { status: true } } },
  });

  if (!enrollment) return { status: 403, error: "Forbidden: You are not enrolled in this course." };
  if (enrollment.status !== "ACTIVE") {
    return { status: 403, error: "Forbidden: Your enrollment is inactive, suspended, or removed." };
  }
  if (enrollment.course?.status !== "ACTIVE") {
    return { status: 403, error: "Forbidden: This course is currently unavailable." };
  }
  return null;
}

/**
 * Middleware: require an ACTIVE enrollment in an ACTIVE course.
 * courseId is read from route params only, so callers cannot redirect the check
 * to a different course via body/query.
 */
async function checkCourseAccess(req, res, next) {
  try {
    const denial = await getCourseAccessDenial(req.user, req.params.courseId);
    if (denial) return res.status(denial.status).json({ error: denial.error });
    return next();
  } catch (error) {
    return serverError(res, error, "Internal server error during authorization", req);
  }
}

module.exports = checkCourseAccess;
module.exports.getCourseAccessDenial = getCourseAccessDenial;
