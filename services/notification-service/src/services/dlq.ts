import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { producer, KafkaTopics } from "../config/kafka.js";
import logger from "../utils/logger.js";

/**
 * DLQ Handler — Routes exhausted notifications to the Dead Letter Queue.
 *
 * After `maxRetries` failed attempts, the notification is:
 * 1. Updated to `DLQ` status in `NotificationLog`.
 * 2. Persisted in the `DeadLetterEntry` table (survives broker retention
 *    expiry, supports manual re-drive via an admin tool).
 * 3. Published to the Kafka `dead-letter-queue` topic for downstream
 *    alerting/re-drive consumers.
 *
 * Never silently drops a message (`.clinerules` §6).
 */

export interface RouteToDlqInput {
  logId: string;
  eventId: string;
  eventType: string;
  recipient: string;
  /** Raw event payload for DLQ re-drive and debugging. */
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
