const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const enrollment = await prisma.enrollment.findFirst({
    where: { source: 'ADMIN' },
  });
  if (!enrollment) {
    console.log("No ADMIN enrollment found");
    return;
  }
  console.log("Found:", enrollment);

  // simulate remove
  if (enrollment.paymentId) {
    console.log("Deleting payment:", enrollment.paymentId);
    // await prisma.payment.delete({ where: { id: enrollment.paymentId } });
  }
  console.log("Deleting enrollment:", enrollment.id);
  // await prisma.enrollment.delete({ where: { id: enrollment.id } });
}
main().finally(() => prisma.$disconnect());
