const prisma = require('./config/database/prismaClient');

async function run() {
  const payment = await prisma.payment.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { createdAt: 'desc' }
  });

  if (!payment) {
    console.log("No SUCCESS payment found.");
    return;
  }

  console.log("Found payment:", payment);

  try {
    await prisma.$transaction(async (tx) => {
      console.log("Creating enrollment...");
      await tx.enrollment.create({
        data: {
          userId: payment.userId,
          courseId: payment.courseId,
          paymentId: payment.id,
          source: "PURCHASE",
          status: "ACTIVE"
        }
      });
      console.log("Enrollment created successfully inside TX!");
      throw new Error("ROLLBACK INTENTIONAL");
    });
  } catch (err) {
    console.error("TX ERROR:", err);
  }
}

run().finally(() => prisma.$disconnect());
