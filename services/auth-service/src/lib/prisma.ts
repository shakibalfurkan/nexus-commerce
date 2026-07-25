import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import logger from "../utils/logger.js";
import { InternalServerError } from "../errors/AppError.js";

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new InternalServerError(
    "DATABASE_URL environment variable is required",
  );
}

const POOL_CONFIG = {
  poolSize: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  maxUses: 7500,
} as const;

const adapter = new PrismaPg({
  connectionString,
  ...POOL_CONFIG,
});

const prisma = new PrismaClient({
  adapter,
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "stdout" },
    { level: "info", emit: "stdout" },
    { level: "warn", emit: "stdout" },
  ],
  errorFormat: "colorless",
});

prisma.$on("query", (e) => {
  if (e.duration > 1000) {
    logger.warn("Slow query detected", {
      query: e.query,
      params: e.params,
      duration: e.duration,
      target: e.target,
    });
  }
});

async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected from database.");
  } catch (err) {
    logger.error("Error disconnecting Prisma:", err);
  }
}

export { prisma, disconnectPrisma };
