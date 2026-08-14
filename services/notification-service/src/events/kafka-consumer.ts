import { kafka } from "../config/kafka.js";
import { KafkaTopics } from "@nexus/event-contracts";
import { parseKafkaMessage, readHeader } from "../types/kafka-message.types.js";
import { routePoisonMessage } from "../services/dlq.js";
import type { NotificationService } from "../services/notification-service.js";
import logger from "../utils/logger.js";

const CONSUMER_GROUP_ID = "notification-service";

let consumer: ReturnType<NonNullable<typeof kafka>["consumer"]> | null = null;

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
    },
  });
}
