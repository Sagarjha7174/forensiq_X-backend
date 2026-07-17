const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { name: { contains: "sagar vishwakarma" } } });
  console.log(user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
