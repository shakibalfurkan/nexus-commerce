import { Kafka, type SASLOptions } from "kafkajs";
import config from "./index.js";
import logger from "../utils/logger.js";

const { broker, username, password } = config.kafka;

export const KafkaTopics = {
  DOMAIN_EVENTS: "domain-events",
  DLQ: "dead-letter-queue",
} as const;

let kafka: Kafka | null = null;
let producer: ReturnType<Kafka["producer"]> | null = null;

if (broker && username && password) {
  kafka = new Kafka({
    clientId: config.serviceName!,
    brokers: [broker],
    ssl: {
      rejectUnauthorized: false,
    },
    sasl: {
      mechanism: "scram-sha-256",
      username,
      password,
    } as SASLOptions,
  });

  producer = kafka.producer();
  logger.info("Kafka client initialized.");
} else {
  logger.warn(
    "Kafka credentials not configured — event publishing will be disabled.",
  );
}

export { kafka, producer };
