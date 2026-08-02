import { kafka, KafkaTopics } from "../config/kafka.js";
import { parseKafkaMessage } from "../types/kafka-message.types.js";
import type { NotificationService } from "../services/notification-service.js";
import logger from "../utils/logger.js";

/**
 * Kafka Consumer — Subscribes to the `domain-events` topic and delegates
 * each message to the NotificationService.
 *
 * Error strategy:
 * - `parseKafkaMessage` failures (malformed JSON, schema validation) →
 *   log and re-throw so KafkaJS redelivers the message.
 * - `processEvent` failures BEFORE log creation (claim, DB errors) →
 *   re-throw so KafkaJS redelivers.
 * - `processEvent` results AFTER log creation (sent, skipped, failed) →
 *   log and acknowledge. The NotificationLog tracks status for retry/DLQ.
 */

const CONSUMER_GROUP_ID = "notification-service";

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

  const consumer = kafka.consumer({
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
    eachMessage: async ({ message }) => {
      const value = message.value?.toString() ?? null;
      const headers = message.headers ?? {};

      let parsed;
      try {
        parsed = parseKafkaMessage(value, headers);
      } catch (error) {
        logger.error("Failed to parse Kafka message", {
          error: error instanceof Error ? error.message : String(error),
          topic: KafkaTopics.DOMAIN_EVENTS,
        });
        // Re-throw: malformed messages should be retried by KafkaJS
        throw error;
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
