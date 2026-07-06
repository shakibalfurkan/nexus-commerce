import { prisma } from "../lib/prisma.js";
import { KafkaTopics } from "../config/kafka.js";
import { resolveTopic } from "./outboxWriter.js";
import { EventBus } from "./eventBus.js";
import logger from "../utils/logger.js";

// ─── Types ───

export interface OutboxPollerOptions {
  pollIntervalMs: number;
  batchSize: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  maxRetries: number;
  lockTimeoutMs: number;
}

const DEFAULT_OPTIONS: OutboxPollerOptions = {
  pollIntervalMs: 1_000,
  batchSize: 100,
  baseBackoffMs: 1_000,
  maxBackoffMs: 60_000,
  maxRetries: 5,
  lockTimeoutMs: 30_000,
};

let effectiveOptions: OutboxPollerOptions = { ...DEFAULT_OPTIONS };

// ─── Poller State ───

let isRunning = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let isBatchProcessing = false;

// ─── Exponential Backoff ───

function calculateBackoff(retryCount: number): number {
  const delay = effectiveOptions.baseBackoffMs * Math.pow(2, retryCount);
  return Math.min(delay, effectiveOptions.maxBackoffMs);
}

// ─── Core Polling Logic ───

async function processNextBatch(): Promise<void> {
  if (isBatchProcessing) return;
  isBatchProcessing = true;

  const now = new Date();
  const lockTimeout = new Date(now.getTime() - effectiveOptions.lockTimeoutMs);

  try {
    const events = await prisma.outboxEvent.findMany({
      where: {
        status: "PENDING",
        AND: [
          {
            OR: [{ lockedAt: null }, { lockedAt: { lt: lockTimeout } }],
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: effectiveOptions.batchSize,
    });

    if (events.length === 0) return;

    // Lock claimed events
    const eventIds = events.map((e) => e.id);
    await prisma.outboxEvent.updateMany({
      where: { id: { in: eventIds } },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        lockedBy: `outbox-poller-${process.pid}`,
      },
    });

    // Publish each event to the correct Kafka topic
    for (const event of events) {
      try {
        const topic = resolveTopic(
          event.eventType,
        ) as (typeof KafkaTopics)[keyof typeof KafkaTopics];

        await EventBus.publish(
          topic,
          event.id,
          event.payload,
          event.traceparent ?? undefined,
        );

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "COMPLETED",
            processedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
          },
        });

        logger.debug(
          `[OutboxPoller] Event ${event.id} (${event.eventType}) published to ${topic}`,
        );
      } catch (error) {
        await handleFailure(event, error);
      }
    }
  } catch (error) {
    logger.error("[OutboxPoller] Error processing batch", error);
  } finally {
    isBatchProcessing = false;
  }
}

async function handleFailure(
  event: { id: string; retryCount: number; eventType: string },
  error: unknown,
): Promise<void> {
  const newRetryCount = event.retryCount + 1;
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (newRetryCount >= effectiveOptions.maxRetries) {
    // Move to DEAD state — Dead Letter Queue
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: "DEAD",
        retryCount: newRetryCount,
        lastError: errorMessage,
        lockedAt: null,
        lockedBy: null,
      },
    });

    logger.error(
      `[OutboxPoller] Event ${event.id} (${event.eventType}) moved to DEAD after ${newRetryCount} retries. Error: ${errorMessage}`,
    );

    // Publish to DLQ topic for downstream alerting
    await publishDeadLetterEvent(event.id, event.eventType, errorMessage);
  } else {
    // Exponential backoff — release the lock for retry
    const backoffMs = calculateBackoff(newRetryCount);

    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: "PENDING",
        retryCount: newRetryCount,
        lastError: errorMessage,
        lockedAt: null,
        lockedBy: null,
      },
    });

    logger.warn(
      `[OutboxPoller] Event ${event.id} (${event.eventType}) failed (retry ${newRetryCount}/${effectiveOptions.maxRetries}). Next retry in ${backoffMs}ms. Error: ${errorMessage}`,
    );
  }
}

async function publishDeadLetterEvent(
  originalEventId: string,
  originalEventType: string,
  errorMessage: string,
): Promise<void> {
  try {
    await EventBus.publish(KafkaTopics.DLQ, `dlq-${originalEventId}`, {
      eventName: "dead_letter.event",
      aggregateId: originalEventId,
      payload: {
        originalEventId,
        originalEventType,
        error: errorMessage,
        failedAt: new Date().toISOString(),
      },
      metadata: {
        emittedAt: new Date().toISOString(),
        source: "user-service-outbox-poller",
        version: 1,
      },
    });
  } catch (dlqError) {
    logger.error(
      `[OutboxPoller] Failed to publish DLQ event for ${originalEventId}`,
      dlqError,
    );
  }
}

// ─── Public API ───

export async function startOutboxPoller(
  options: Partial<OutboxPollerOptions> = {},
): Promise<void> {
  if (isRunning) {
    logger.warn("[OutboxPoller] Already running");
    return;
  }

  effectiveOptions = { ...DEFAULT_OPTIONS, ...options };
  isRunning = true;

  logger.info(
    `[OutboxPoller] Started. Interval: ${effectiveOptions.pollIntervalMs}ms, Batch size: ${effectiveOptions.batchSize}`,
  );

  await processNextBatch();
  pollInterval = setInterval(processNextBatch, effectiveOptions.pollIntervalMs);
  pollInterval.unref();
}

export async function stopOutboxPoller(): Promise<void> {
  isRunning = false;

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  logger.info("[OutboxPoller] Stopped");
}
