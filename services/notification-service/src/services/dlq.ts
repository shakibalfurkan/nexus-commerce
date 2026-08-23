import { prisma } from "../lib/prisma.js";
import { eventBus } from "../events/eventBus.js";
import { publishDeadLetterEvent } from "@nexus/kafka";
import logger from "../utils/logger.js";

export interface RouteToDlqInput {
  logId: string;
  eventId: string;
  eventType: string;
  recipient: string;
  payload: unknown;
  failureReason: string;
  attemptCount: number;
  traceparent?: string;
  correlationId?: string;
}

export async function routeToDlq(input: RouteToDlqInput): Promise<void> {
  // 1. Update NotificationLog to DLQ
  await prisma.notificationLog.update({
    where: { id: input.logId },
    data: {
      status: "DLQ",
      lastError: input.failureReason,
    },
  });


  // 2. Publish to the shared DLQ topic via @nexus/kafka's helper so the
  // message matches DeadLetterEventSchema and is consumable by the central
  // admin table in user-service. Best-effort: the NotificationLog row (status
  // DLQ + lastError) remains the per-service source of truth.
  if (eventBus) {
    const bus = eventBus;
    await publishDeadLetterEvent({
      serviceName: "notification-service",
      eventId: input.eventId,
      eventType: input.eventType,
      failureStage: "consume",
      errorMessage: input.failureReason,
      rawPayload: JSON.stringify(input.payload),
      traceparent: input.traceparent,
      correlationId: input.correlationId,
      publish: (p) => bus.publish(p),
      logger,
    });
  }

  logger.error("Notification routed to DLQ", {
    logId: input.logId,
    eventId: input.eventId,
    eventType: input.eventType,
    attemptCount: input.attemptCount,
    failureReason: input.failureReason,
  });
}

// ─── Poison-Message Routing ───

export interface RoutePoisonMessageInput {
  /** Stable dedup key — `${topic}:${partition}:${offset}`. */
  dedupeKey: string;
  /** Raw (unparsed) Kafka payload for debugging / manual re-drive. */
  rawPayload: string;
  failureReason: string;
  traceparent?: string;
  correlationId?: string;
}

/**
 * Route a poison message — a Kafka payload that fails JSON.parse or schema
 * validation before a NotificationLog row can be claimed. Permanently
 * malformed, so re-throwing would cause KafkaJS infinite redelivery
 * (.clinerules §6). Publish to the shared DLQ topic, then ACK.
 */
export async function routePoisonMessage(
  input: RoutePoisonMessageInput,
): Promise<void> {
  await publishDeadLetterEvent({
    serviceName: "notification-service",
    eventId: input.dedupeKey,
    eventType: null, // payload failed parse/schema — type not trustworthy
    failureStage: "consume",
    errorMessage: input.failureReason,
    rawPayload: input.rawPayload,
    traceparent: input.traceparent,
    correlationId: input.correlationId,
    publish: eventBus
      ? (p) => {
          // Narrowed once — TS can't keep the `eventBus` narrowing inside
          // the closure.
          const bus = eventBus;
          return bus ? bus.publish(p) : Promise.resolve();
        }
      : async () => {
          logger.warn("Kafka unconfigured — poison message logged only", {
            eventId: input.dedupeKey,
          });
        },
    logger,
  });

  logger.error("Poison message routed to DLQ", {
    eventId: input.dedupeKey,
    failureReason: input.failureReason,
  });
}
