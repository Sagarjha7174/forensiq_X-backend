const jwt = require("jsonwebtoken");
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: process.env.ADMIN_EMAIL } });
  if (!admin) { console.log("Admin not found"); return; }
  const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
  console.log(token);
}
main().catch(console.error).finally(() => prisma.$disconnect());
