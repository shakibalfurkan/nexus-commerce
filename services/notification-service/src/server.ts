import createApp from "./app.js";
import config from "./config/index.js";
import { startKafkaConsumer } from "./events/kafka-consumer.js";
import { createLogger } from "@nexus/logger";

const port = process.env.PORT || config.port;

async function main(): Promise<void> {
  const logger = createLogger({
    serviceName: config.serviceName,
    node_env: config.node_env,
  });

  try {
    // Create app
    const app = createApp();

    await startKafkaConsumer();
    logger.info("✅ Kafka Consumer connected");

    // Start server
    app.listen(port, () => {
      logger.info(`Nexus ${config.serviceName} is listening on port: ${port}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
  }
}

main();
