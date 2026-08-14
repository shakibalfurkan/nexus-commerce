import {
  OutboxPoller,
  OutboxListener,
  type OutboxListenerHandlers,
} from "@nexus/kafka";
import { prisma } from "../lib/prisma.js";
import { kafka, producer } from "../config/kafka.js";
import { createEventBus } from "@nexus/kafka";
import { resolveTopic } from "./outboxWriter.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";

// ─── Outbox EventBus (publish only — subscribers are per-service consumers) ───
// Reuses the same Kafka+producer from config; createEventBus.publish rethrows so
// the poller's retry/DLQ path triggers correctly (fixes the silent false-completion bug).
const eventBus = kafka && producer ? createEventBus(kafka, producer, logger) : null;

// ─── Outbox Poller (interval fallback) ───

const poller = new OutboxPoller({
  prisma,
  serviceName: config.serviceName,
  resolveTopic: (eventType: string) => resolveTopic(eventType),
  publish: eventBus
    ? async (params) => eventBus.publish(params)
    : async () => {
        logger.warn("[OutboxPoller] EventBus not available — cannot publish");
      },
  logger,
  options: {
    // Slow safety-net: the OutboxListener is the primary trigger.
    fallbackPollIntervalMs: 30_000,
    batchSize: 100,
    baseBackoffMs: 1_000,
    maxBackoffMs: 60_000,
    maxRetries: 5,
    lockTimeoutMs: 30_000,
  },
});

// ─── Outbox Listener (Postgres LISTEN/NOTIFY — primary trigger) ───
// WHY the listener exists alongside the poller: NOTIFY is fire-and-forget and
// drops messages sent while disconnected, so the interval fallback is the
// durability net. The listener receives NEW.id::text from the trigger but
// IGNORES the payload (B4) — it simply calls poller.handleNotification which
// triggers a full batch drain.

const listenerHandlers: OutboxListenerHandlers = {
  onEvent: (eventId) => poller.handleNotification(eventId),
  onError: (error) => logger.error("[OutboxListener]", error),
};

const listener = new OutboxListener(
  {
    connectionString: process.env.DATABASE_URL!,
    channel: "outbox_channel",
    maxReconnectAttempts: 10,
  },
  listenerHandlers,
  logger,
);

// ─── Public API (same exports as the old file, so server.ts imports unchanged) ───

export async function startOutboxPoller(): Promise<void> {
  // Start the listener first so it is subscribed before any initial drain races.
  await listener.start();
  await poller.start();
  logger.info("[Outbox] Listener + poller started");
}

export async function stopOutboxPoller(): Promise<void> {
  await listener.stop();
  await poller.stop();
  logger.info("[Outbox] Listener + poller stopped");
}