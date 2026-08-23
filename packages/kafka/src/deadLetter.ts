import { KafkaTopics, DLQEventTypes } from "@nexus/event-contracts";
import type { Logger } from "@nexus/logger";

export interface DeadLetterPublishParams {
  serviceName: string;
  eventId: string;
  /** `null` when the original event type is unknown (e.g. parse failures). */
  eventType: string | null;
  /** Where the failure happened — defaults to `"publish"` (outbox path). */
  failureStage?: "publish" | "consume";
  errorMessage: string;
  /** Raw message preserved verbatim for inspection / re-drive (optional). */
  rawPayload?: string | undefined;
  /** exactOptionalPropertyTypes-friendly: callers may pass `undefined`. */
  traceparent?: string | undefined;
  correlationId?: string | undefined;
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
      sourceService: params.serviceName,
      originalEventId: params.eventId,
      originalEventType: params.eventType,
      failureStage: params.failureStage ?? "publish",
      error: params.errorMessage,
      ...(params.rawPayload !== undefined ? { rawPayload: params.rawPayload } : {}),
      failedAt: now,
    },
    ...(params.traceparent !== undefined ? { traceparent: params.traceparent } : {}),
    ...(params.correlationId !== undefined
      ? { correlationId: params.correlationId }
      : {}),
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
