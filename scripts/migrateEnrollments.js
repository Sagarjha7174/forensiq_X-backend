const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration...");

  // 1. Migrate Payment to Enrollment
  const successfulPayments = await prisma.payment.findMany({
    where: {
      status: 'SUCCESS'
    }
  });

  let enrolledCount = 0;
  for (const payment of successfulPayments) {
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: payment.userId,
          courseId: payment.courseId
        }
      }
    });

    if (!existing) {
      await prisma.enrollment.create({
        data: {
          userId: payment.userId,
          courseId: payment.courseId,
          paymentId: payment.id,
          source: 'PURCHASE',
          status: 'ACTIVE',
          enrolledAt: payment.createdAt,
          activatedAt: payment.createdAt
        }
      });
      enrolledCount++;
    }
  }
  console.log(`Migrated ${enrolledCount} payments to enrollments.`);

  // 2. Migrate User.isActive to User.accountStatus
  const users = await prisma.user.findMany();
  let updatedUsers = 0;
  for (const user of users) {
    if (user.isActive && user.accountStatus !== 'ACTIVE') {
      await prisma.user.update({
        where: { id: user.id },
        data: { accountStatus: 'ACTIVE' }
      });
      updatedUsers++;
    } else if (!user.isActive && user.accountStatus !== 'INACTIVE') {
      await prisma.user.update({
        where: { id: user.id },
        data: { accountStatus: 'INACTIVE' }
      });
      updatedUsers++;
    }
  }
  console.log(`Migrated ${updatedUsers} user account statuses.`);

  // 3. Set existing courses to ACTIVE instead of DRAFT
  const draftCourses = await prisma.course.findMany({
    where: { status: 'DRAFT' }
  });
  let updatedCourses = 0;
  for (const course of draftCourses) {
    await prisma.course.update({
      where: { id: course.id },
      data: { status: 'ACTIVE' }
    });
    updatedCourses++;
  }
  console.log(`Migrated ${updatedCourses} courses from DRAFT to ACTIVE.`);

  console.log("Migration complete.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
