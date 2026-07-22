const prisma = require("../../config/database/prismaClient");
const { orderConfirmationEmail } = require("../../utils/mailService");

const assignCourse = async (req, res) => {
  try {
    const { userIds, courseId, source = "ADMIN" } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !courseId) {
      return res.status(400).json({ error: "Missing required fields" });
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
          razorpayOrderId: `MANUAL_${Date.now()}_${userId.substring(0, 5)}`
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
        include: { user: true, course: true }
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
              paymentId: payment.razorpayOrderId,
              orderId: payment.razorpayOrderId
            }
          });
        } catch (err) {
          console.error(`Failed to send manual assignment email to ${enrollment.user.email}:`, err);
        }
      }
    }

    res.status(201).json({
      message: "Courses assigned successfully",
      assigned,
      skipped
    });
  } catch (err) {
    console.error("Assign course error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { assignCourse };
