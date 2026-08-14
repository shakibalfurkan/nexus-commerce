import { v4 as uuidv4 } from "uuid";
import type { PrismaTransaction } from "../types/database.types.js";
import type { TDomainEvent, TNotificationEvent } from "./eventTypes.js";
import { KafkaTopics } from "../config/kafka.js";

// ─── Topic Router ───
// All domain + notification events publish to DOMAIN_EVENTS; DLQ events to DLQ.
// The `COMMANDS`/`NOTIFICATIONS` topic keys were removed: they referenced
// non-existent KafkaTopics (KafkaTopics only defines DOMAIN_EVENTS + DLQ in
// @nexus/event-contracts) and the corresponding events never had a registered
// producer schema — dead config.
const eventTopicMap: Record<
  string,
  (typeof KafkaTopics)[keyof typeof KafkaTopics]
> = {
  "user.registered": KafkaTopics.DOMAIN_EVENTS,
  "user.deleted": KafkaTopics.DOMAIN_EVENTS,
  "user.hard_deleted": KafkaTopics.DOMAIN_EVENTS,
  "user.restored": KafkaTopics.DOMAIN_EVENTS,
  "user.profile_updated": KafkaTopics.DOMAIN_EVENTS,
  "user.password_changed": KafkaTopics.DOMAIN_EVENTS,
  "user.email_changed": KafkaTopics.DOMAIN_EVENTS,
  "user.role_changed": KafkaTopics.DOMAIN_EVENTS,
  "user.locked": KafkaTopics.DOMAIN_EVENTS,
  "user.unlocked": KafkaTopics.DOMAIN_EVENTS,
  "order.placed": KafkaTopics.DOMAIN_EVENTS,
  "payment.succeeded": KafkaTopics.DOMAIN_EVENTS,
  "dead_letter.event": KafkaTopics.DLQ,
};

export function resolveTopic(eventType: string): string {
  const topic = eventTopicMap[eventType];
  if (!topic) {
    return KafkaTopics.DOMAIN_EVENTS;
  }
  return topic;
}

// ─── Outbox Writer ───

export async function writeOutboxEvent(
  tx: PrismaTransaction,
  event: TDomainEvent | TNotificationEvent,
  traceparent?: string,
): Promise<string> {
  const id = uuidv4();

  await tx.outboxEvent.create({
    data: {
      id,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event as any,
      traceparent: traceparent ?? null,
      status: "PENDING",
      retryCount: 0,
      maxRetries: 5,
    },
  });

  return id;
}

export async function emitDomainEvent(
  tx: PrismaTransaction,
  event: TDomainEvent,
  traceparent?: string,
): Promise<string> {
  return writeOutboxEvent(tx, event, traceparent);
}

export async function emitNotificationEvent(
  tx: PrismaTransaction,
  event: TNotificationEvent,
  traceparent?: string,
): Promise<string> {
  return writeOutboxEvent(tx, event, traceparent);
}
