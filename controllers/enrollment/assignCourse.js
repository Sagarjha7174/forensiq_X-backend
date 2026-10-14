const prisma = require("../../config/database/prismaClient");
const { orderConfirmationEmail } = require("../../utils/mailService");
const { serverError } = require("../../utils/httpErrors");
const logger = require("../../utils/logger");

// Admin-granted enrollments may not masquerade as purchases.
const ADMIN_SOURCES = ["ADMIN", "MANUAL", "SCHOLARSHIP"];
const SAFE_USER_SELECT = { id: true, name: true, email: true };

const assignCourse = async (req, res) => {
  try {
    const { userIds, courseId, source = "ADMIN" } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !courseId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (userIds.length > 500 || !userIds.every((u) => typeof u === "string")) {
      return res.status(400).json({ error: "Invalid userIds" });
    }
    if (!ADMIN_SOURCES.includes(source)) {
      return res.status(400).json({ error: "Invalid enrollment source" });
    }

    // Check if course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const assigned = [];
    const skipped = [];

    for (const userId of userIds) {
      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        skipped.push({ userId, reason: "User not found" });
        continue;
      }

      // Check for existing enrollment
      const existing = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId }
        }
      });

      if (existing) {
        skipped.push({ userId, reason: "Already enrolled" });
        continue;
      }

      // Create dummy payment for historical reasons/backward compatibility if needed
      // but strictly we can just create Enrollment. We'll create a dummy payment to satisfy 
      // legacy queries that might still look at Payment, but new ones will use Enrollment.
      const payment = await prisma.payment.create({
        data: {
          userId,
          courseId,
          amount: 0,
          status: 'SUCCESS',
          cashfreeOrderId: `MANUAL_${Date.now()}_${userId.substring(0, 5)}`
        }
      });

      const enrollment = await prisma.enrollment.create({
        data: {
          userId,
          courseId,
          paymentId: payment.id,
          source,
          status: 'ACTIVE',
          activatedAt: new Date()
        },
        include: { user: { select: SAFE_USER_SELECT }, course: { select: { id: true, name: true, description: true } } }
      });

      assigned.push(enrollment);

      // Send Order Confirmation Email
      if (enrollment.user && enrollment.user.email) {
        try {
          await orderConfirmationEmail({
            to: enrollment.user.email,
            fullName: enrollment.user.name,
            details: {
              courseName: enrollment.course.name,
              courseDescription: enrollment.course.description,
              amount: 0,
              paymentId: payment.cashfreeOrderId,
              orderId: payment.cashfreeOrderId
            }
          });
        } catch (err) {
          logger.error("Failed to send manual assignment email", { requestId: req.id, userId: enrollment.userId, error: err });
        }
      }
    }

    res.status(201).json({
      message: "Courses assigned successfully",
      assigned,
      skipped
    });
  } catch (err) {
    return serverError(res, err, "Internal server error", req);
  }
};

module.exports = { assignCourse };
