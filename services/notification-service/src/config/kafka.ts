import { Kafka, type SASLOptions } from "kafkajs";
import config from "./index.js";
import logger from "../utils/logger.js";
import { InternalServerError } from "../errors/AppError.js";

const { broker, username, password } = config.kafka;
if (!broker || !username || !password) {
  logger.error("CRITICAL: Missing Kafka Environment Variables.");
  throw new InternalServerError(
    "❌ CRITICAL: Missing Kafka Environment Variables.",
    "kafka_config",
  );
}

export const kafka = new Kafka({
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

export const producer = kafka.producer();
