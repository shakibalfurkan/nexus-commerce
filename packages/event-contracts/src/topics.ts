/**
 * Kafka topic constants. Only two topics exist (5-topic Aiven free-tier cap);
 * prior COMMANDS/NOTIFICATIONS keys were removed as dead config referencing
 * non-existent topics.
 */
export const KafkaTopics = {
  DOMAIN_EVENTS: "domain-events",
  DLQ: "dead-letter-queue",
} as const;

export type KafkaTopic = (typeof KafkaTopics)[keyof typeof KafkaTopics];
