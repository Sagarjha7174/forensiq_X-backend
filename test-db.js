const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({ take: 2 });
  console.log(courses);
}
main().finally(() => prisma.$disconnect());
