import { createKafkaClient, type Kafka, type Producer } from "@nexus/kafka";
import config from "./index.js";

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
  console.warn(
    "Kafka credentials not configured — event publishing will be disabled.",
  );
}

export { kafka, producer };
