import {
  Kafka,
  type Producer,
  type SASLOptions,
} from "kafkajs";
import { type Logger } from "@nexus/logger";

export type { Kafka, Producer };

// ─── Types ───

export interface KafkaClientOptions {
  serviceName: string;
  node_env: string;
  broker: string;
  username: string;
  password: string;
  /**
   * Reject untrusted TLS certificates. Default true (secure). Set to false only
   * for a local dev broker with a self-signed cert — never in production.
   */
  sslRejectUnauthorized?: boolean;
  /** SASL mechanism. Default "scram-sha-256". */
  saslMechanism?: "scram-sha-256" | "scram-sha-512" | "plain";
}

export interface PublishOptions {
  topic: string;
  key: string;
  value: unknown;
  traceparent?: string;
}

/** Per-message metadata surfaced to a subscribe handler (for dedupe/logging). */
export interface SubscribeMessageContext {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  traceparent?: string;
}

export interface SubscribeOptions {
  topic: string;
  groupId: string;
  handler: (data: unknown, context: SubscribeMessageContext) => Promise<void>;
}

export interface EventBus {
  publish: (options: PublishOptions) => Promise<void>;
  /** Returns an unsubscribe function that disconnects that consumer. */
  subscribe: (options: SubscribeOptions) => Promise<() => Promise<void>>;
  /** Disconnect the producer and any tracked consumers (graceful shutdown). */
  disconnect: () => Promise<void>;
}

// ─── Kafka Client Factory ───

export function createKafkaClient(options: KafkaClientOptions): {
  kafka: Kafka;
  producer: ReturnType<Kafka["producer"]>;
} {
  // B9: default to strict TLS verification (secure). Explicitly opt out only
  // for local development against a self-signed broker.
  const rejectUnauthorized = options.sslRejectUnauthorized ?? true;
  const mechanism = options.saslMechanism ?? "scram-sha-256";

  const kafka = new Kafka({
    clientId: options.serviceName,
    brokers: [options.broker],
    ssl: {
      rejectUnauthorized,
    },
    sasl: {
      mechanism,
      username: options.username,
      password: options.password,
    } as SASLOptions,
  });

  return { kafka, producer: kafka.producer() };
}

// ─── EventBus (shared publish/subscribe with graceful shutdown) ───

export function createEventBus(
  kafka: Kafka,
  producer: ReturnType<Kafka["producer"]>,
  logger: Logger,
): EventBus {
  let isProducerConnected = false;
  const consumers = new Set<ReturnType<Kafka["consumer"]>>();

  return {
    async publish({ topic, key, value, traceparent }: PublishOptions): Promise<void> {
      // WHY errors are logged AND re-thrown: the outbox poller treats a publish
      // rejection as the retry/DLQ signal. Older local `eventBus` copies caught
      // the error without rethrowing, so the poller marked events COMPLETED
      // while they were never actually delivered — silent data loss.
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

    async subscribe({ topic, groupId, handler }: SubscribeOptions): Promise<() => Promise<void>> {
      const consumer = kafka.consumer({
        groupId,
        sessionTimeout: 30_000,
        heartbeatInterval: 3_000,
      });
      consumers.add(consumer);

      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });

      logger.info(`[EventBus] Listening to ${topic} as ${groupId}...`);

      await consumer.run({
        eachMessage: async ({ topic: t, partition, message }) => {
          const payload = JSON.parse(message.value?.toString() || "{}");
          const traceparent = message.headers?.traceparent?.toString();
          await handler(payload, {
            topic: t,
            partition,
            offset: message.offset,
            key: message.key?.toString() ?? null,
            ...(traceparent !== undefined ? { traceparent } : {}),
          });
        },
      });

      return async () => {
        consumers.delete(consumer);
        await consumer.disconnect();
      };
    },

    async disconnect(): Promise<void> {
      for (const consumer of consumers) {
        try {
          await consumer.disconnect();
        } catch (error) {
          logger.warn("[EventBus] Error disconnecting consumer", error);
        }
      }
      consumers.clear();

      if (isProducerConnected && producer) {
        try {
          await producer.disconnect();
          isProducerConnected = false;
        } catch (error) {
          logger.warn("[EventBus] Error disconnecting producer", error);
        }
      }
    },
  };
}
