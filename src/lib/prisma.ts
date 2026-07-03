import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import logger from "../utils/logger.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected from database.");
  } catch (err) {
    logger.error("Error disconnecting Prisma:", err);
  }
}

export { prisma, disconnectPrisma };
