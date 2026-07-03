import { createServer, type Server } from "http";
import { createApp } from "./app.js";
import config from "./config/index.js";
import logger from "./utils/logger.js";
import { disconnectPrisma, prisma } from "./lib/prisma.js";
import { redisClient } from "./config/redis.js";

let server: Server;

async function main(): Promise<void> {
  try {
    // Create app
    const app = createApp();

    // Verify Prisma connection
    await prisma.$connect();
    logger.info("Prisma connected to database.");

    // Verify Redis connection
    await redisClient.ping();
    logger.info("Redis Database handshake verified successfully.");

    server = createServer(app);

    server.listen(config.port, () => {
      logger.info(
        `ClassyShop ${config.serviceName} is running on port ${config.port}`,
      );
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    if (signal === "uncaughtException") {
      server.closeAllConnections();
    }

    server.close(async () => {
      logger.info("HTTP server closed.");

      await Promise.allSettled([redisClient.quit(), disconnectPrisma()]);

      logger.info("Graceful shutdown complete. Exiting.");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000).unref();
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
});

main();
