import {
  Kafka,
  type KafkaConfig,
  type SASLOptions,
  type Producer,
} from "kafkajs";
import { createLogger } from "@nexus/logger";

export type { Kafka, Producer };

// ─── Types ───

export interface KafkaClientOptions {
  serviceName: string;
  node_env: string;
  broker: string;
  username: string;
  password: string;
}

export interface PublishOptions {
  topic: string;
  key: string;
  value: unknown;
  traceparent?: string;
}

// ─── Kafka Client Factory ───

export function createKafkaClient(options: KafkaClientOptions): {
  kafka: Kafka;
  producer: ReturnType<Kafka["producer"]>;
} {
  const logger = createLogger({
    serviceName: options.serviceName,
    node_env: options.node_env,
  });

  const kafka = new Kafka({
    clientId: options.serviceName,
    brokers: [options.broker],
    ssl: {
      rejectUnauthorized: false,
    },
    sasl: {
      mechanism: "scram-sha-256",
      username: options.username,
      password: options.password,
    } as SASLOptions,
  });

  const producer = kafka.producer();

  logger.info("Kafka client initialized.");

  return { kafka, producer };
}

// ─── EventBus (shared publish/subscribe with idempotency hooks) ───

export interface EventBus {
  publish: (options: PublishOptions) => Promise<void>;
  subscribe: (options: {
    topic: string;
    groupId: string;
    handler: (data: unknown) => Promise<void>;
  }) => Promise<void>;
}

export function createEventBus(
  kafka: Kafka,
  producer: ReturnType<Kafka["producer"]>,
  logger: ReturnType<typeof createLogger>,
): EventBus {
  let isProducerConnected = false;

  return {
    publish: async ({ topic, key, value, traceparent }: PublishOptions) => {
      try {
        if (!isProducerConnected) {
          await producer.connect();
          isProducerConnected = true;
        }

        await producer.send({
          topic,
          messages: [
            {
              key,
              value: JSON.stringify(value),
              headers: traceparent ? { traceparent } : {},
            },
          ],
        });

        logger.info(`[EventBus] Sent to ${topic}`);
      } catch (error) {
        logger.error(`[EventBus] Publish Error:`, error);
        throw error;
      }
    },

    subscribe: async ({
      topic,
      groupId,
      handler,
    }: {
      topic: string;
      groupId: string;
      handler: (data: unknown) => Promise<void>;
    }) => {
      const consumer = kafka.consumer({
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });

      logger.info(`[EventBus] Listening to ${topic} as ${groupId}...`);

      await consumer.run({
        eachMessage: async ({ message }) => {
          try {
            const payload = JSON.parse(message.value?.toString() || "{}");
            await handler(payload);
          } catch (error) {
            logger.error(`[EventBus] Processing Error:`, error);
            throw error;
          }
        },
      });
    },
  };
}

// ─── DLQ Routing Helper ───

export function buildDeadLetterEvent(
  originalEventId: string,
  originalEventType: string,
  errorMessage: string,
  source: string,
) {
  return {
    eventId: crypto.randomUUID(),
    eventType: "dead_letter.event",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    producer: source,
    correlationId: originalEventId,
    payload: {
      originalEventId,
      originalEventType,
      error: errorMessage,
      failedAt: new Date().toISOString(),
    },
  };
}
