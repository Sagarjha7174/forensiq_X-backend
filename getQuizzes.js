const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const courses = await prisma.course.findMany({ include: { quizess: true } });
  console.log(JSON.stringify(courses.filter(c => c.quizess.length > 0)[0], null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
