import { KafkaTopics } from "@nexus/event-contracts";
import { eventBus } from "../../events/eventBus.js";
import logger from "../../utils/logger.js";
import { handleDeadLetterMessage } from "./deadLetterConsumer.js";

const CONSUMER_GROUP_ID = "user-service-dead-letters";

/**
 * Subscribes the central dead-letter consumer to the DLQ topic through the
 * shared EventBus — same pattern as notification-service's domain consumer.
 * No-op (with a warning) when Kafka is unconfigured, matching every other
 * service's local/dev behavior.
 */
export async function startDeadLetterConsumer(): Promise<void> {
  if (!eventBus) {
    logger.warn(
      "Kafka not configured — dead-letter consumer will not start. " +
        "Set KAFKA_BROKER, KAFKA_USERNAME, KAFKA_PASSWORD to enable.",
    );
    return;
  }

  await eventBus.subscribe({
    topic: KafkaTopics.DLQ,
    groupId: CONSUMER_GROUP_ID,
    handler: handleDeadLetterMessage,
  });
  logger.info(`Dead-letter consumer subscribed to ${KafkaTopics.DLQ}`);
}
