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
        isActive: typeof isActive === "boolean" ? isActive : user.isActive
      };

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      await tx.user.update({
        where: { id: uid },
        data: updateData
      });

      /* =========================
         2️⃣ ADMIN: Grant courses safely
      ========================= */
      if (Array.isArray(courseIds) && courseIds.length > 0) {
        for (const courseId of courseIds) {
          // Check if already SUCCESS
          const successPayment = await tx.payment.findFirst({
            where: {
              userId: uid,
              courseId,
              status: "SUCCESS"
            }
          });

          // If already has access → skip
          if (successPayment) {
            continue;
          }

          // Clean any stale payments
          await tx.payment.deleteMany({
            where: {
              userId: uid,
              courseId,
              status: { in: ["CREATED", "FAILED"] }
            }
          });

          // Grant fresh SUCCESS payment
          await tx.payment.create({
            data: {
              userId: uid,
              courseId,
              amount: 0,
              status: "SUCCESS",
              razorpayOrderId: `ADMIN_${uid}_${courseId}_${Date.now()}`
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
