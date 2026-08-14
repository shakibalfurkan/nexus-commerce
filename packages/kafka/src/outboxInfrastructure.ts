import type { Kafka, Producer } from "kafkajs";
import type { Logger } from "@nexus/logger";
import { OutboxPoller } from "./outboxPoller.js";
import { OutboxListener } from "./outboxListener.js";
import { createEventBus } from "./eventBus.js";
import type {
  OutboxEventDb,
  OutboxPollerOptions,
  TopicResolver,
} from "./types.js";

/**
 * Everything a service needs to wire the shared outbox to its Kafka producer
 * and Postgres LISTEN/NOTIFY channel — in one place.
 *
 * Both `auth-service` and `user-service` previously duplicated this exact
 * glue (construct the EventBus, the poller, the listener, and re-export
 * start/stop). This factory is the single source; each service passes its
 * Prisma client, its resolved `kafka`/`producer`, its service name, and its
 * event-type → topic resolver.
 *
 * The listener reads `process.env.DATABASE_URL` directly — it must connect to
 * the same DB the outbox table lives in (separate from the producer's broker).
 */
export interface OutboxInfrastructureDeps {
  /** Service's Prisma client (structural match for {@link OutboxEventDb}). */
  prisma: OutboxEventDb;
  /** Kafka client + producer. Null when Kafka is unconfigured (publishing off). */
  kafka: Kafka | null;
  producer: Producer | null;
  /** Canonical service name — used for locking identity and the DLQ `source`. */
  serviceName: string;
  /** Service-specific event type → Kafka topic mapping. */
  resolveTopic: TopicResolver;
  /** Shared logger (never console.log). */
  logger: Logger;
  /** Poller tuning; falls back to {@link DEFAULT_OUTBOX_POLLER_OPTIONS}. */
  options?: Partial<OutboxPollerOptions>;
  /** Postgres NOTIFY channel. Default "outbox_channel". */
  channel?: string;
  /** Max listener reconnect attempts. Default 10. */
  maxReconnectAttempts?: number;
}

export interface OutboxInfrastructure {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createOutboxInfrastructure(
  deps: OutboxInfrastructureDeps,
): OutboxInfrastructure {
  const {
    prisma,
    serviceName,
    kafka,
    producer,
    resolveTopic,
    logger,
    options,
    channel = "outbox_channel",
    maxReconnectAttempts = 10,
  } = deps;

  // Reuses the same Kafka producer from config; createEventBus.publish rethrows
  // so the poller's retry/DLQ path triggers (fixes the silent false-completion bug).
  const eventBus =
    kafka && producer ? createEventBus(kafka, producer, logger) : null;

  const poller = new OutboxPoller({
    prisma,
    serviceName,
    resolveTopic,
    publish: eventBus
      ? (params) => eventBus.publish(params)
      : async () => {
          logger.warn("[OutboxPoller] EventBus not available — cannot publish");
        },
    logger,
    // exactOptionalPropertyTypes: only attach `options` when actually provided,
    // so an `undefined` value is never explicitly assigned to an optional prop.
    ...(options ? { options } : {}),
  });

  // WHY the listener exists alongside the poller: NOTIFY is fire-and-forget and
  // drops messages sent while disconnected, so the interval fallback is the
  // durability net. The listener receives NEW.id::text from the trigger but
  // IGNORES the payload — it simply calls poller.handleNotification which
  // triggers a full batch drain.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "[OutboxInfrastructure] DATABASE_URL is required to start the outbox LISTEN/NOTIFY listener",
    );
  }

  const listener = new OutboxListener(
    { connectionString, channel, maxReconnectAttempts },
    {
      onEvent: (eventId) => poller.handleNotification(eventId),
      onError: (error) => logger.error("[OutboxListener]", error),
    },
    logger,
  );

  return {
    // Start the listener first so it is subscribed before any initial drain races.
    async start() {
      await listener.start();
      await poller.start();
      logger.info("[Outbox] Listener + poller started");
    },
    async stop() {
      await listener.stop();
      await poller.stop();
      logger.info("[Outbox] Listener + poller stopped");
    },
  };
}