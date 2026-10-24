import { KafkaTopics } from "@nexus/event-contracts";
import { eventBus } from "../eventBus.js";
import logger from "../../utils/logger.js";
import {
  ROLE_SYNC_CONSUMER_GROUP_ID,
  handleRoleSyncMessage,
} from "./roleSyncConsumer.js";

/**
 * Subscribes auth-service's role-replica sync consumer to `domain-events`.
 *
 * No-op (with a warning) when Kafka is unconfigured, matching every other
 * service's local/dev behavior — the HTTP surface still starts.
 */
export async function startRoleSyncConsumer(): Promise<void> {
  if (!eventBus) {
    logger.warn(
      "Kafka not configured — role sync consumer will not start. " +
        "Set KAFKA_BROKER, KAFKA_USERNAME, KAFKA_PASSWORD to enable.",
    );
    return;
  }

  await eventBus.subscribe({
    topic: KafkaTopics.DOMAIN_EVENTS,
    groupId: ROLE_SYNC_CONSUMER_GROUP_ID,
    handler: handleRoleSyncMessage,
  });

  logger.info(
    `Role sync consumer subscribed to ${KafkaTopics.DOMAIN_EVENTS} as ${ROLE_SYNC_CONSUMER_GROUP_ID}`,
  );
}
