import { KafkaTopics, DLQEventTypes } from "@nexus/event-contracts";

/**
 * Routes an event type to its Kafka topic.
 *
 * Every domain event publishes to `KafkaTopics.DOMAIN_EVENTS`; only the
 * dead-letter event routes to `KafkaTopics.DLQ`. This replaces the per-service
 * `eventTopicMap` + `resolveTopic` copies — the map was pure noise because both
 * implementations already fell through to `DOMAIN_EVENTS` for any unknown type.
 */
export function resolveTopic(eventType: string): string {
  return eventType === DLQEventTypes.DEAD_LETTER_EVENT
    ? KafkaTopics.DLQ
    : KafkaTopics.DOMAIN_EVENTS;
}
