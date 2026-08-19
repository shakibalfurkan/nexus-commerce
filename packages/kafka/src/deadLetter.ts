import { KafkaTopics, DLQEventTypes } from "@nexus/event-contracts";
import type { Logger } from "@nexus/logger";

export interface DeadLetterPublishParams {
  serviceName: string;
  eventId: string;
  eventType: string;
  errorMessage: string;
  publish: (params: {
    topic: string;
    key: string;
    value: unknown;
  }) => Promise<void>;
  logger: Logger;
}

// Publish a dead-letter event for an exhausted outbox event to the DLQ topic.
export async function publishDeadLetterEvent(
  params: DeadLetterPublishParams,
): Promise<void> {
  const now = new Date().toISOString();

  const value = {
    eventType: DLQEventTypes.DEAD_LETTER_EVENT,
    aggregateId: params.eventId,
    payload: {
      originalEventId: params.eventId,
      originalEventType: params.eventType,
      error: params.errorMessage,
      failedAt: now,
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
