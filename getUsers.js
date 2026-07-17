const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    include: {
      payments: {
        where: { status: "SUCCESS" },
        include: { course: true }
      }
    }
  });
  console.log("First user:", JSON.stringify(users[0], null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
