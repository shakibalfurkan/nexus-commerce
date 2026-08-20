import { KafkaTopics } from "@nexus/event-contracts";
import type { SubscribeMessageContext } from "@nexus/kafka";
import { parseKafkaMessage } from "../types/kafka-message.types.js";
import { routePoisonMessage } from "../services/dlq.js";
import type { NotificationService } from "../services/notificationService.js";
import { eventBus } from "./eventBus.js";
import logger from "../utils/logger.js";

const CONSUMER_GROUP_ID = "notification-service";

/**
 * Handles one raw domain-event message.
 *
 * The shared `EventBus.subscribe()` hands over the RAW value (never a forced
 * `JSON.parse`) precisely so this boundary logic survives: a malformed payload
 * must reach `parseKafkaMessage` and throw `ValidationError`, which is what
 * distinguishes a poison message from a transient processing failure.
 *
 * Failure semantics (unchanged from the previous hand-rolled consumer):
 *   - parse/schema failure → `routePoisonMessage` then RETURN (ACK). Never
 *     re-thrown: the payload is permanently malformed, so redelivery would
 *     loop forever.
 *   - processing failure before a NotificationLog row exists → re-thrown so
 *     KafkaJS redelivers (at-least-once).
 *   - processing failure after the log row exists → already handled inside
 *     `processEvent` (retry/DLQ via the log's attemptCount).
 */
export async function handleDomainEventMessage(
  service: NotificationService,
  rawValue: string | null,
  context: SubscribeMessageContext,
): Promise<void> {
  const { topic, partition, offset, headers } = context;

  let parsed;
  try {
    parsed = parseKafkaMessage(rawValue, headers);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const traceparent = context.traceparent;
    const correlationId = headers.correlationid ?? headers["correlation-id"];

    logger.error("Failed to parse Kafka message — routing to DLQ", {
      topic,
      partition,
      offset,
      error: errorMsg,
    });

    await routePoisonMessage({
      dedupeKey: `${topic}:${partition}:${offset}`,
      rawPayload: rawValue ?? "",
      failureReason: errorMsg,
      ...(traceparent !== undefined ? { traceparent } : {}),
      ...(correlationId !== undefined ? { correlationId } : {}),
    });
    return;
  }

  try {
    const result = await service.processEvent(parsed);

    logger.info("Event processed", {
      eventId: parsed.event.aggregateId,
      eventType: parsed.event.eventType,
      status: result.status,
      ...(result.status === "sent" ? { logId: result.logId } : {}),
      ...(result.status === "skipped" ? { reason: result.reason } : {}),
      ...(result.status === "failed"
        ? {
            logId: result.logId,
            error: result.error,
            routedToDlq: result.routedToDlq,
          }
        : {}),
    });
  } catch (error) {
    logger.error("Event processing failed before log creation", {
      eventId: parsed.event.aggregateId,
      eventType: parsed.event.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Subscribes the notification pipeline to the domain-events topic through the
 * service's shared EventBus.
 *
 * Returns without subscribing when Kafka is unconfigured — the previous
 * consumer warned and returned here too, so a broker-less local run still
 * serves HTTP instead of crashing.
 */
export async function startDomainEventConsumer(
  service: NotificationService,
): Promise<void> {
  if (!eventBus) {
    logger.warn(
      "Kafka not configured — consumer will not start. " +
        "Set KAFKA_BROKER, KAFKA_USERNAME, KAFKA_PASSWORD to enable.",
    );
    return;
  }

  await eventBus.subscribe({
    topic: KafkaTopics.DOMAIN_EVENTS,
    groupId: CONSUMER_GROUP_ID,
    handler: (rawValue, context) =>
      handleDomainEventMessage(service, rawValue, context),
  });
}
