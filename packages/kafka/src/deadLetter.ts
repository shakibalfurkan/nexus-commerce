import { KafkaTopics, DLQEventTypes } from "@nexus/event-contracts";
import type { Logger } from "@nexus/logger";

export interface DeadLetterPublishParams {
  /** Canonical service name — becomes the DLQ event `source`. NEVER hardcoded. */
  serviceName: string;
  eventId: string;
  eventType: string;
  errorMessage: string;
  /** Kafka publisher the service already wired (topic comes from the contracts). */
  publish: (params: {
    topic: string;
    key: string;
    value: unknown;
  }) => Promise<void>;
  logger: Logger;
}

/**
 * Publish a dead-letter event for an exhausted outbox event to the DLQ topic.
 *
 * WHY the service name is a parameter and never hardcoded: the original
 * duplicated pollers copy-pasted `source: "user-service-outbox-poller"` into
 * BOTH services, so auth-service emitted DLQ events falsely labeled as
 * user-service. Downstream alerting/redrive could not trust `source`.
 *
 * WHY we use `eventType` / `aggregateId` / `metadata`: this matches the
 * canonical event discriminator (the outbox DB column and producer wire
 * format) so DLQ consumers see the same shape they expect from domain events.
 * The `KafkaTopics.DLQ` topic name is imported from `@nexus/event-contracts`
 * (never hardcoded or duplicated here).
 *
 * The publish is BEST-EFFORT: the outbox row's DEAD status is the source of
 * truth for manual redrive, so a Kafka failure here is logged but not thrown
 * (throwing would break the poller's batch loop for a secondary concern).
 */
export async function publishDeadLetterEvent(
  params: DeadLetterPublishParams,
): Promise<void> {
  const now = new Date().toISOString();

  const value = {
    // Canonical discriminator name is `eventType` (matches the outbox DB
    // column and producer wire format) — never `eventName`.
    eventType: DLQEventTypes.DEAD_LETTER_EVENT,
    aggregateId: params.eventId,
    payload: {
      originalEventId: params.eventId,
      originalEventType: params.eventType,
      error: params.errorMessage,
      failedAt: now,
    },
    metadata: {
      emittedAt: now,
      source: params.serviceName,
      version: 1,
    },
  };

  try {
    await params.publish({
      topic: KafkaTopics.DLQ,
      key: `dlq-${params.eventId}`,
      value,
    });
  } catch (error) {
    params.logger.error(
      `[OutboxPoller] Failed to publish DLQ event for ${params.eventId}`,
      error,
    );
  }
}
