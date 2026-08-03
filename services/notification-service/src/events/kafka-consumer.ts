import { kafka, KafkaTopics } from "../config/kafka.js";
import { parseKafkaMessage, readHeader } from "../types/kafka-message.types.js";
import { routePoisonMessage } from "../services/dlq.js";
import type { NotificationService } from "../services/notification-service.js";
import logger from "../utils/logger.js";

/**
 * Kafka Consumer — Subscribes to the `domain-events` topic and delegates
 * each message to the NotificationService.
 *
 * Error strategy:
 * - `parseKafkaMessage` failures (malformed JSON, schema validation) →
 *   poison message — route to DLQ and ACK (never infinite-redeliver).
 * - `processEvent` failures BEFORE log creation (claim, DB errors) →
 *   re-throw so KafkaJS redelivers.
 * - `processEvent` results AFTER log creation (sent, skipped, failed) →
 *   log and acknowledge. The NotificationLog tracks status for retry/DLQ.
 */

const CONSUMER_GROUP_ID = "notification-service";

let consumer: ReturnType<NonNullable<typeof kafka>["consumer"]> | null = null;

/**
 * Gracefully disconnect the Kafka consumer (called on shutdown).
 */
export async function disconnectKafkaConsumer(): Promise<void> {
  if (consumer) {
    try {
      await consumer.disconnect();
      logger.info("Kafka consumer disconnected.");
    } catch (err) {
      logger.error("Error disconnecting Kafka consumer:", err);
    }
  }
}

export async function startKafkaConsumer(
  service: NotificationService,
): Promise<void> {
  if (!kafka) {
    logger.warn(
      "Kafka not configured — consumer will not start. " +
        "Set KAFKA_BROKER, KAFKA_USERNAME, KAFKA_PASSWORD to enable.",
    );
    return;
  }

  consumer = kafka.consumer({
    groupId: CONSUMER_GROUP_ID,
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: KafkaTopics.DOMAIN_EVENTS,
    fromBeginning: false,
  });

  logger.info(
    `Kafka consumer listening to "${KafkaTopics.DOMAIN_EVENTS}" as group "${CONSUMER_GROUP_ID}"`,
  );

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString() ?? null;
      const headers = message.headers ?? {};

      let parsed;
      try {
        parsed = parseKafkaMessage(value, headers);
      } catch (error) {
        // Poison message — permanently malformed. Re-throwing would cause
        // KafkaJS to infinitely redeliver (`.clinerules` §6). Route to DLQ
        // and ACK instead.
        const errorMsg = error instanceof Error ? error.message : String(error);
        const offset = message.offset;
        const traceparent = readHeader(headers, "traceparent");
        const correlationId =
          readHeader(headers, "correlationid") ??
          readHeader(headers, "correlation-id");

        logger.error("Failed to parse Kafka message — routing to DLQ", {
          topic,
          partition,
          offset,
          error: errorMsg,
        });

        await routePoisonMessage({
          dedupeKey: `${topic}:${partition}:${offset}`,
          rawPayload: value ?? "",
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
          eventType: parsed.event.eventName,
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
        // Error BEFORE log creation — re-throw so KafkaJS redelivers
        logger.error("Event processing failed before log creation", {
          eventId: parsed.event.aggregateId,
          eventType: parsed.event.eventName,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  });
}
