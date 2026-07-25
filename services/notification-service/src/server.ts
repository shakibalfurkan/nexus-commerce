import createApp from "./app.js";
import config from "./config/index.js";
import { startKafkaConsumer } from "./events/kafka-consumer.js";
import logger from "./utils/logger.js";

const port = process.env.PORT || config.port;

async function main(): Promise<void> {
  try {
    // Create app
    const app = createApp();

    await startKafkaConsumer();
    logger.info("✅ Kafka Consumer connected");

    // Start server
    app.listen(port, () => {
      logger.info(
        `ClassyShop ${config.serviceName} is listening on port: ${port}`,
      );
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
  }
}

main();
