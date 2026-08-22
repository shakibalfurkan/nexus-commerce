import { createServer, type Server } from "http";
import config from "./config/index.js";
import { disconnectRedis, redis } from "./lib/redis.js";
import { eventBus } from "./events/eventBus.js";
import { disconnectPrisma, prisma } from "./lib/prisma.js";
import logger from "./utils/logger.js";
import { startNotificationPipeline } from "./container.js";
import createApp from "./app.js";

let server: Server;
const port = process.env.PORT || config.port;

async function main(): Promise<void> {
  try {
    // Verify dependencies BEFORE accepting traffic
    await prisma.$connect();
    logger.info("Prisma connected to database.");

    await redis!.ping();
    logger.info("Redis Database handshake verified successfully.");

    await startNotificationPipeline(); // Kafka consumer + outbox poller

    const app = createApp();
    server = createServer(app);
    server.listen(port, () => {
      logger.info(`Nexus ${config.serviceName} is listening on port: ${port}`);
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
      disconnectRedis(),
      eventBus ? eventBus.disconnect() : Promise.resolve(),
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
