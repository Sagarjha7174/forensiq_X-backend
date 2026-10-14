const prisma = require("../config/database/prismaClient");
const logger = require("./logger");

exports.checkConnection = async () => {
  try {
    await prisma.$connect();
    logger.info("Database connection successful");
  } catch (error) {
    logger.error("Error connecting to the database", { error });
  }
};
