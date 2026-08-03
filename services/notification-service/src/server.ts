import createApp from "./app.js";
import config from "./config/index.js";
import { startNotificationPipeline } from "./container.js";
import { disconnectRedis } from "./lib/redis.js";
import { disconnectPrisma } from "./lib/prisma.js";
import { disconnectKafkaProducer } from "./config/kafka.js";
import { disconnectKafkaConsumer } from "./events/kafka-consumer.js";
import logger from "./utils/logger.js";

const port = process.env.PORT || config.port || "3000";

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Gracefully shut down: disconnect Kafka, Redis, and Prisma so in-flight
 * writes complete and no connections leak. Cloud (Render) sends SIGTERM on
 * deploy/restart — without this, the process can be killed mid-write.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await disconnectKafkaConsumer();
    await disconnectKafkaProducer();
    await disconnectRedis();
    await disconnectPrisma();
    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error("Error during graceful shutdown", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

async function main(): Promise<void> {
  try {
    // Create app
    const app = createApp();

    // Start server
    app.listen(port, () => {
      logger.info(`Nexus ${config.serviceName} is listening on port: ${port}`);
    });

    // Start Kafka consumer + notification pipeline
    await startNotificationPipeline();
  } catch (err) {
    logger.error("Failed to start server:", err);
    // Fail fast — don't run a half-broken server that silently drops events.
    process.exit(1);
  }
}

main();
