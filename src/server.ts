import { createServer, type Server } from "http";
import { createApp } from "./app.js";
import config from "./config/index.js";
import logger from "./utils/logger.js";

let server: Server;

const port = process.env.PORT || config.port;

async function main(): Promise<void> {
  try {
    // Create app
    const app = createApp();

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
