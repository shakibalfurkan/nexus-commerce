import { createKafkaClient, type Kafka, type Producer } from "@nexus/kafka";
import { KafkaTopics } from "@nexus/event-contracts";
import { createLogger } from "@nexus/logger";
import config from "./index.js";

const { broker, username, password } = config.kafka;

const logger = createLogger({
  serviceName: config.serviceName,
  node_env: config.node_env,
});

let kafka: Kafka | null = null;
let producer: Producer | null = null;

if (broker && username && password) {
  const client = createKafkaClient({
    serviceName: config.serviceName,
    node_env: config.node_env,
    broker,
    username,
    password,
  });
  kafka = client.kafka;
  producer = client.producer;
} else {
  logger.warn(
    "Kafka credentials not configured — event publishing will be disabled.",
  );
}

/**
 * Gracefully disconnect the Kafka producer (called on shutdown).
 */
export async function disconnectKafkaProducer(): Promise<void> {
  if (producer) {
    try {
      await producer.disconnect();
    } catch (err) {
      logger.error("Error disconnecting Kafka producer:", err);
    }
  }
}

export { kafka, producer, KafkaTopics };