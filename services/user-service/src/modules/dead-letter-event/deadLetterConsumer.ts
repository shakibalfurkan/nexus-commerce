import { DeadLetterEventSchema } from "@nexus/event-contracts";
import type { SubscribeMessageContext } from "@nexus/kafka";
import { parseJsonMessage } from "@nexus/kafka";
import * as repository from "./deadLetterEvent.repository.js";
import logger from "../../utils/logger.js";

/**
 * Central dead-letter consumer — subscribes to KafkaTopics.DLQ and persists
 * every dead-letter event (outbox-publish failures from any service,
 * consume-stage failures from notification-service) into the single admin
 * table.
 *
 * Intentionally simple per design: parse, Zod-validate, insert, log. No retry
 * logic — a failure writing to our own database is a genuine local error.
 *
 * Idempotency (at-least-once DLQ topic): `@@unique([sourceService, eventId])`
 * makes duplicate deliveries a no-op via upsert-style handling below. For
 * poison messages `eventId` is the stable `topic:partition:offset` key, so
 * redelivery dedup survives the old local-table guard.
 */
export async function handleDeadLetterMessage(
  rawValue: string | null,
  context: SubscribeMessageContext,
): Promise<void> {
  const parsed = DeadLetterEventSchema.safeParse(parseJsonMessage(rawValue));

  if (!parsed.success) {
    // A malformed DLQ message can't be persisted meaningfully — log and ACK so
    // one bad row doesn't wedge the consumer group forever.
    logger.error("Discarding malformed dead-letter message", {
      topic: context.topic,
      partition: context.partition,
      offset: context.offset,
      issues: parsed.error.issues,
    });
    return;
  }

  const event = parsed.data;
  const payload = event.payload;

  try {
    await repository.create({
      sourceService: payload.sourceService,
      eventId: payload.originalEventId,
      eventType: payload.originalEventType,
      failureStage: payload.failureStage,
      errorMessage: payload.error,
      payload: payload.rawPayload,
      traceparent: event.traceparent,
      correlationId: event.correlationId,
    });
    logger.warn("Dead-letter event recorded", {
      sourceService: payload.sourceService,
      eventId: payload.originalEventId,
      eventType: payload.originalEventType,
      failureStage: payload.failureStage,
    });
  } catch (error) {
    // Genuine local error (DB down) — rethrow so KafkaJS redelivers rather
    // than silently dropping the event. Duplicate-key races on redelivery are
    // expected at-least-once noise, not failures.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      logger.warn("Duplicate dead-letter event — already recorded", {
        sourceService: payload.sourceService,
        eventId: payload.originalEventId,
      });
      return;
    }
    throw error;
  }
}
