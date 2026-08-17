import { Kafka, type Producer, type SASLOptions, type IHeaders } from "kafkajs";
import { type Logger } from "@nexus/logger";

export type { Kafka, Producer };

// ─── Types ───

export interface KafkaClientOptions {
  serviceName: string;
  node_env: string;
  broker: string;
  username: string;
  password: string;
  sslRejectUnauthorized?: boolean;
  saslMechanism?: "scram-sha-256" | "scram-sha-512" | "plain";
}

export interface PublishOptions {
  topic: string;
  key: string;
  value: unknown;
  traceparent?: string;
}

/** String-decoded view of Kafka message headers (Buffer/Uint8Array → string). */
export interface KafkaMessageHeaders {
  [key: string]: string | undefined;
}

export interface SubscribeMessageContext {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  /** All message headers, string-decoded. */
  headers: KafkaMessageHeaders;
  /** Convenience: the `traceparent` header, when present. */
  traceparent?: string;
}

export interface SubscribeOptions {
  topic: string;
  groupId: string;
  /**
   * Called for each message with the RAW (unparsed) value and decoded headers.
   * The handler owns parsing, schema validation, and poison-message DLQ routing
   * so services with custom boundary logic (e.g. notification-service's
   * `parseKafkaMessage` + `routePoisonMessage`) keep their exact behavior.
   * Services with plain-JSON payloads can `JSON.parse(rawValue ?? "{}")` inline
   * (or use {@link parseJsonMessage}). A thrown error propagates to the Kafka
   * consumer and triggers redelivery (at-least-once semantics).
   */
  handler: (
    rawValue: string | null,
    context: SubscribeMessageContext,
  ) => Promise<void>;
}

export interface EventBus {
  /**
   * Eagerly connect the producer so a broker misconfiguration fails at startup
   * instead of on the first publish. Idempotent — `publish` connects lazily on
   * its own, so calling this is optional.
   */
  connect: () => Promise<void>;
  publish: (options: PublishOptions) => Promise<void>;
  subscribe: (options: SubscribeOptions) => Promise<() => Promise<void>>;
  disconnect: () => Promise<void>;
}

/**
 * Convenience parser for services with plain-JSON payloads: parses a raw Kafka
 * message value into `unknown`, treating null/empty as an empty object.
 * Services with schema validation or poison-message DLQ routing should parse
 * inside their `subscribe()` handler instead (see {@link SubscribeOptions}).
 */
export function parseJsonMessage(rawValue: string | null): unknown {
  return JSON.parse(rawValue ?? "{}");
}

/**
 * Decodes kafkajs `IHeaders` (Buffer/Uint8Array/string, possibly arrays) into
 * the string-keyed {@link KafkaMessageHeaders} shape handed to subscribe
 * handlers. `null`/`undefined` values are dropped so handlers can branch with
 * `headers[key] !== undefined` (kept distinct from an empty-string header).
 */
function decodeHeaders(headers: IHeaders | undefined): KafkaMessageHeaders {
  const decoded: KafkaMessageHeaders = {};
  if (!headers) {
    return decoded;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) {
      continue;
    }
    const first = Array.isArray(value) ? value[0] : value;
    if (first === undefined || first === null) {
      continue;
    }
    decoded[key] =
      first instanceof Uint8Array ? first.toString() : String(first);
  }
  return decoded;
}

// ─── Kafka Client Factory ───

export function createKafkaClient(options: KafkaClientOptions): {
  kafka: Kafka;
  producer: ReturnType<Kafka["producer"]>;
} {
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
    async connect(): Promise<void> {
      if (isProducerConnected) {
        return;
      }
      await producer.connect();
      isProducerConnected = true;
    },

    async publish({
      topic,
      key,
      value,
      traceparent,
    }: PublishOptions): Promise<void> {
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

    async subscribe({
      topic,
      groupId,
      handler,
    }: SubscribeOptions): Promise<() => Promise<void>> {
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
          const rawValue = message.value?.toString() ?? null;
          const headers = decodeHeaders(message.headers);
          const traceparent = headers.traceparent;
          await handler(rawValue, {
            topic: t,
            partition,
            offset: message.offset,
            key: message.key?.toString() ?? null,
            headers,
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
