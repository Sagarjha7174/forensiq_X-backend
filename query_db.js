const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const enrollments = await prisma.enrollment.findMany({
    orderBy: { enrolledAt: 'desc' },
    take: 3,
    include: { course: true }
  });
  console.log(JSON.stringify(enrollments, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
