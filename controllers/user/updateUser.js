const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const updateUser = async (req, res) => {
  const uid = req.params.id;
  const {
    email,
    name,
    password,
    phone,
    degree,
    classes,
    isActive,
    accountStatus,
    isVerified,
    role,
    courseIds // ADMIN ONLY
  } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: uid }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.$transaction(async (tx) => {
      /* =========================
         1️⃣ Update user profile
      ========================= */
      const updateData = {
        email: email ?? user.email,
        name: name ?? user.name,
        phone: phone ?? user.phone,
        degree: degree ?? user.degree,
        classes: classes ?? user.classes,
        isActive: typeof isActive === "boolean" ? isActive : user.isActive,
        accountStatus: accountStatus ?? user.accountStatus,
        isVerified: typeof isVerified === "boolean" ? isVerified : user.isVerified,
        role: role ?? user.role
      };

      // If updating isActive manually via old frontend, sync to accountStatus
      if (typeof isActive === "boolean" && !accountStatus) {
        updateData.accountStatus = isActive ? 'ACTIVE' : 'INACTIVE';
      }

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      await tx.user.update({
        where: { id: uid },
        data: updateData
      });

      /* =========================
         2️⃣ ADMIN: Grant courses safely (Backward Compatibility)
      ========================= */
      if (Array.isArray(courseIds) && courseIds.length > 0) {
        for (const courseId of courseIds) {
          // Check for existing enrollment
          const existingEnrollment = await tx.enrollment.findUnique({
            where: {
              userId_courseId: { userId: uid, courseId }
            }
          });

          if (existingEnrollment) {
            continue; // Already enrolled
          }

          // Generate dummy payment for legacy queries
          const payment = await tx.payment.create({
            data: {
              userId: uid,
              courseId,
              amount: 0,
              status: "SUCCESS",
              razorpayOrderId: `ADMIN_${uid}_${courseId}_${Date.now()}`
            }
          });

          // Create true enrollment
          await tx.enrollment.create({
            data: {
              userId: uid,
              courseId,
              paymentId: payment.id,
              source: "ADMIN",
              status: "ACTIVE",
              activatedAt: new Date()
            }
          });
        }
      }
    });

    res.status(200).json({
      message: "User updated successfully"
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      error: "An error occurred while updating the user."
    });
  }
};

module.exports = { updateUser };
