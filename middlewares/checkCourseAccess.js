const prisma = require("../config/database/prismaClient");

/**
 * Middleware to check if the current user has an ACTIVE enrollment for a course.
 * This can be used for endpoints where courseId is explicitly provided in params.
 */
async function checkCourseAccess(req, res, next) {
  // Try to find courseId in params, body, or query
  const courseId = req.params.courseId || req.body.courseId || req.query.courseId;

  if (!courseId) {
    // If there's no courseId to check, we can't authorize at the course level generically here.
    // Use this middleware ONLY on routes that have a courseId.
    return res.status(400).json({ error: "courseId is required for authorization" });
  }

  // Admin bypass
  if (req.user && (req.user.role === "ADMIN" || req.user.role === "SUPERADMIN")) {
    return next();
  }

  try {
    const userId = req.user.id;
    
    // Check enrollment and course status
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: userId,
          courseId: courseId,
        }
      },
      include: {
        course: true
      }
    });

    if (!enrollment) {
      return res.status(403).json({ error: "Forbidden: You are not enrolled in this course." });
    }

    if (enrollment.status !== "ACTIVE") {
      return res.status(403).json({ error: "Forbidden: Your enrollment is inactive, suspended, or removed." });
    }

    if (enrollment.course.status !== "ACTIVE") {
      return res.status(403).json({ error: "Forbidden: This course is currently unavailable." });
    }

    // Access granted
    next();
  } catch (error) {
    console.error("Authorization check error:", error);
    res.status(500).json({ error: "Internal server error during authorization" });
  }
}

module.exports = checkCourseAccess;
