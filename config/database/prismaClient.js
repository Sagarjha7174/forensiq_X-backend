const { PrismaClient } = require("@prisma/client");

// Global singleton — prevents connection pool exhaustion.
// Without this, every controller/middleware that calls `new PrismaClient()`
// opens its own connection pool, which quickly exhausts the Aiven free-tier limit (10 connections).
if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

module.exports = global.__prisma;
