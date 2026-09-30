const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Payment" CASCADE;');
  console.log('Truncated Payment table');
}
main().finally(() => prisma.$disconnect());
