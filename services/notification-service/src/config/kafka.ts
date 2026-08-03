import { createKafkaClient, type Kafka, type Producer } from "@nexus/kafka";
import config from "./index.js";
import logger from "../utils/logger.js";

const broker = config.kafka.broker ?? "";
const username = config.kafka.username ?? "";
const password = config.kafka.password ?? "";

export const KafkaTopics = {
  DOMAIN_EVENTS: "domain-events",
  DLQ: "dead-letter-queue",
} as const;

let kafka: Kafka | null = null;
let producer: Producer | null = null;

if (broker && username && password) {
  const client = createKafkaClient({
    serviceName: config.serviceName ?? "notification-service",
    node_env: config.node_env ?? "development",
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
      logger.info("Kafka producer disconnected.");
    } catch (err) {
      logger.error("Error disconnecting Kafka producer:", err);
    }
  }
}

export { kafka, producer };
