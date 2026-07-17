// Import the Prisma Client
const { PrismaClient } = require("@prisma/client");

// Create a new instance of PrismaClient
const prisma = new PrismaClient();

exports.checkConnection = async () => {
  try {
    await prisma.$connect();
    console.log("Database connection successful!");
  } catch (error) {
    console.error("Error connecting to the database:", error);
  } finally {
    // Disconnect from the database to avoid keeping the connection open
    await prisma.$disconnect();
  }
};
