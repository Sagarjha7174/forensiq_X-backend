const { PrismaClient } = require("@prisma/client");
if (!global.prisma) {
  global.prisma = new PrismaClient();
}

prisma = global.prisma;

module.exports = prisma;
