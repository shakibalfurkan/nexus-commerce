import { createServer, type Server } from "http";
import { createApp } from "./app.js";
import config from "./config/index.js";
import { redisClient } from "./config/redis.js";
import { producer } from "./config/kafka.js";
import { disconnectPrisma, prisma } from "./lib/prisma.js";
import logger from "./utils/logger.js";
import { startOutboxPoller } from "./events/outboxPoller.js";

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

    // Connect Kafka producer once at startup
    if (producer) {
      await producer.connect();
      logger.info("Kafka producer connected successfully.");

      // Start the outbox poller to process pending events
      await startOutboxPoller();
    } else {
      logger.warn(
        "Kafka credentials not configured — event publishing and outbox poller disabled.",
      );
    }

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
  logger.info(`${signal} received. Starting graceful shutdown sequence...`);

  const watchdog = setTimeout(() => {
    logger.error(
      `Forced shutdown executed. Graceful cleanup timed out after 10s.`,
    );
    process.exit(1);
  }, 10_000);

  watchdog.unref();

  try {
    if (server) {
      logger.info("Severing active HTTP connections and stopping listener...");

      server.closeAllConnections();

      await new Promise<void>((resolve) => {
        server.close(() => {
          logger.info("HTTP server listener closed successfully.");
          resolve();
        });
      });
    }

    logger.info("Closing stateful infrastructure channels...");
    await Promise.allSettled([
      redisClient.quit(),
      producer ? producer.disconnect() : Promise.resolve(),
      disconnectPrisma(),
    ]);

    logger.info(
      "All stateful connections closed cleanly. Graceful exit success.",
    );
    process.exit(0);
  } catch (error) {
    logger.error(
      "An error occurred during the graceful shutdown sequence:",
      error,
    );
    process.exit(1);
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
