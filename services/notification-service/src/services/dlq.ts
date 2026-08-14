import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { producer } from "../config/kafka.js";
import { KafkaTopics } from "@nexus/event-contracts";
import logger from "../utils/logger.js";

export interface RouteToDlqInput {
  logId: string;
  eventId: string;
  eventType: string;
  recipient: string;
  payload: unknown;
  failureReason: string;
  attemptCount: number;
  traceparent?: string;
  correlationId?: string;
}

export async function routeToDlq(input: RouteToDlqInput): Promise<void> {
  // 1. Update NotificationLog to DLQ
  await prisma.notificationLog.update({
    where: { id: input.logId },
    data: {
      status: "DLQ",
      lastError: input.failureReason,
    },
  });

  // 2. Persist in DeadLetterEntry table
  await prisma.deadLetterEntry.create({
    data: {
      eventId: input.eventId,
      eventType: input.eventType,
      recipient: input.recipient,
      payload: input.payload as Prisma.InputJsonValue,
      failureReason: input.failureReason,
      attemptCount: input.attemptCount,
      ...(input.traceparent !== undefined
        ? { traceparent: input.traceparent }
        : {}),
      ...(input.correlationId !== undefined
        ? { correlationId: input.correlationId }
        : {}),
    },
  });

  // 3. Publish to Kafka DLQ topic (if producer is available)
  if (producer) {
    try {
      await producer.send({
        topic: KafkaTopics.DLQ,
        messages: [
          {
            key: input.eventId,
            value: JSON.stringify({
              eventId: input.eventId,
              eventType: input.eventType,
              failureReason: input.failureReason,
              attemptCount: input.attemptCount,
              recipient: input.recipient,
            }),
          },
        ],
      });
    } catch (error) {
      // Don't fail the DLQ routing if Kafka publish fails — the DB entry
      // is the source of truth and supports manual re-drive.
      logger.error("Failed to publish DLQ event to Kafka", {
        eventId: input.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.error("Notification routed to DLQ", {
    logId: input.logId,
    eventId: input.eventId,
    eventType: input.eventType,
    attemptCount: input.attemptCount,
    failureReason: input.failureReason,
  });
}

// ─── Poison-Message Routing ───

export interface RoutePoisonMessageInput {
  /** Stable dedup key — `${topic}:${partition}:${offset}`. */
  dedupeKey: string;
  /** Raw (unparsed) Kafka payload for debugging / manual re-drive. */
  rawPayload: string;
  failureReason: string;
  traceparent?: string;
  correlationId?: string;
}

/**
 * Route a poison message — a Kafka payload that fails JSON.parse or schema
 * validation before a NotificationLog row can be claimed. Permanently
 * malformed, so re-throwing would cause KafkaJS infinite redelivery
 * (`.clinerules` §6). Persist to DeadLetterEntry + publish to DLQ topic,
 * then ACK.
 */
export async function routePoisonMessage(
  input: RoutePoisonMessageInput,
): Promise<void> {
  // Idempotency guard for at-least-once redelivery (e.g. crash after publish).
  const existing = await prisma.deadLetterEntry.findFirst({
    where: { eventId: input.dedupeKey },
    select: { id: true },
  });
  if (existing) {
    logger.warn("Poison message already routed to DLQ — skipping", {
      eventId: input.dedupeKey,
    });
    return;
  }

  await prisma.deadLetterEntry.create({
    data: {
      eventId: input.dedupeKey,
      eventType: "kafka.parse_error",
      // Recipient is not derivable from a malformed message. The raw payload
      // is preserved verbatim for manual inspection / re-drive.
      recipient: "unknown",
      payload: input.rawPayload,
      failureReason: input.failureReason,
      attemptCount: 1,
      ...(input.traceparent !== undefined
        ? { traceparent: input.traceparent }
        : {}),
      ...(input.correlationId !== undefined
        ? { correlationId: input.correlationId }
        : {}),
    },
  });

  if (producer) {
    try {
      await producer.send({
        topic: KafkaTopics.DLQ,
        messages: [
          {
            key: input.dedupeKey,
            value: JSON.stringify({
              eventId: input.dedupeKey,
              failureReason: input.failureReason,
              rawPayload: input.rawPayload,
            }),
          },
        ],
      });
    } catch (error) {
      // DB entry is the source of truth — Kafka publish failure must not
      // fail the ACK path (the message is already safe from infinite retry).
      logger.error("Failed to publish poison message to Kafka DLQ", {
        eventId: input.dedupeKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.error("Poison message routed to DLQ", {
    eventId: input.dedupeKey,
    failureReason: input.failureReason,
  });
}
