const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const enrollment = await prisma.enrollment.findFirst();
  console.log("Removing enrollment:", enrollment.id);
  
  if (enrollment.paymentId && (enrollment.source === 'MANUAL' || enrollment.source === 'ADMIN')) {
    try {
      await prisma.payment.delete({ where: { id: enrollment.paymentId } });
    } catch (err) {
      console.error("Could not delete associated payment:", err);
    }
  }

  try {
    await prisma.enrollment.delete({ where: { id: enrollment.id } });
    console.log("SUCCESS");
  } catch(e) {
    console.log("ERROR", e);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
