import { createKafkaClient, type Kafka, type Producer } from "@nexus/kafka";
import { createLogger } from "@nexus/logger";
import config from "./index.js";

const logger = createLogger({
  serviceName: config.serviceName,
  node_env: config.node_env,
});

const { broker, username, password } = config.kafka;

export const KafkaTopics = {
  DOMAIN_EVENTS: "domain-events",
  DLQ: "dead-letter-queue",
} as const;

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

export { kafka, producer };
