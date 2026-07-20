const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. Create a dummy user
  const user = await prisma.user.create({
    data: {
      email: `test-remove-${Date.now()}@example.com`,
      name: "Test Remove",
      password: "password",
      phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      degree: "BTech",
      classes: "CS",
    }
  });

  // 2. Create a dummy course
  const course = await prisma.course.create({
    data: {
      name: "Test Course",
      description: "Desc",
      price: 100,
      status: "ACTIVE"
    }
  });

  // 3. Assign course
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      courseId: course.id,
      razorpayOrderId: `test-order-${Date.now()}`,
      status: "SUCCESS",
      amount: course.price
    }
  });

  const enrollment = await prisma.enrollment.create({
    data: {
      userId: user.id,
      courseId: course.id,
      paymentId: payment.id,
      source: "ADMIN",
      status: "ACTIVE",
    }
  });

  console.log("Created enrollment:", enrollment.id, "with payment:", payment.id);

  // 4. Remove enrollment
  try {
    if (enrollment.paymentId && (enrollment.source === 'MANUAL' || enrollment.source === 'ADMIN')) {
      console.log("Attempting to delete payment:", enrollment.paymentId);
      await prisma.payment.delete({ where: { id: enrollment.paymentId } });
      console.log("Payment deleted successfully");
    }

    console.log("Attempting to delete enrollment:", enrollment.id);
    await prisma.enrollment.delete({ where: { id: enrollment.id } });
    console.log("Enrollment deleted successfully");

  } catch (err) {
    console.error("Error during removal:", err);
  } finally {
    // cleanup
    await prisma.course.delete({ where: { id: course.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
