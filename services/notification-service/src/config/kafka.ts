import { createKafkaClient, type Kafka, type Producer } from "@nexus/kafka";
import config from "./index.js";
import logger from "../utils/logger.js";

const broker = config.kafka.broker ?? "";
const username = config.kafka.username ?? "";
const password = config.kafka.password ?? "";

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

// NOTE: no `disconnectKafkaProducer` here. The service's EventBus
// (`src/events/eventBus.ts`) owns both the producer and the consumers, so
// `eventBus.disconnect()` in `server.ts` is the single shutdown path.

export { kafka, producer };
