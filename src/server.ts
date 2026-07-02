import { createServer, type Server } from "http";
import createApp from "./app.js";
import config from "./config/index.js";
import { redisClient } from "./config/redis.js";
import logger from "./utils/logger.js";

let server: Server;

async function main() {
  try {
    const app = createApp();

    // Verify Redis connection
    try {
      await redisClient.ping();
      logger.info("Redis Database handshake verified successfully.");
    } catch (redisError) {
      logger.warn(
        "Redis connection failed. Rate limiting will fall back to in-memory store.",
        redisError,
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
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    if (signal === "uncaughtException") {
      server.closeAllConnections();
    }
    server.close(async () => {
      logger.info("HTTP server closed.");

      // Close Redis connection
      try {
        await redisClient.quit();
        logger.info("Redis connection closed.");
      } catch (err) {
        logger.error("Error closing Redis connection:", err);
      }

      logger.info("Graceful shutdown complete.");
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000).unref();
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
});

main();
