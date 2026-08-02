import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import type { TNotificationType } from "../events/domain-event.schemas.js";
import logger from "../utils/logger.js";

/**
 * Idempotency Layer — Guards against Kafka's at-least-once delivery by
 * treating the event's `aggregateId` as a unique idempotency key.
 *
 * Pattern: "claim" a PENDING NotificationLog row before processing. If a
 * duplicate delivery arrives, the unique constraint on `eventId` raises a
 * Prisma P2002, which we catch and treat as "already processed" — the
 * duplicate is silently skipped.
 *
 * The caller (M5 service layer) MUST update the log to SENT/FAILED after
 * processing. The M4 resilience engine handles retry scheduling and DLQ
 * routing based on `attemptCount` / `maxRetries`.
 */

// ─── Types ───

export type IdempotencyResult =
  | { status: "claimed"; logId: string }
  | { status: "duplicate" };

export interface ClaimNotificationInput {
  /** Idempotency key — the Kafka envelope's per-event `aggregateId`. */
  eventId: string;
  /** Domain event name (e.g. "email.verification.otp.sent"). */
  eventType: string;
  /** Notification type (mirrors the Prisma enum). */
  notificationType: TNotificationType;
  /** Recipient email address. */
  recipient: string;
  /** Email subject line (optional — set after template rendering in M5). */
  subject?: string;
  /** Raw event payload snapshot for DLQ re-drive and debugging. */
  payloadSnapshot?: unknown;
  /** W3C traceparent propagated from Kafka headers. */
  traceparent?: string;
  /** Logical correlation ID (falls back to aggregateId when absent). */
  correlationId?: string;
  /** Causation ID — the event/command that directly caused this notification. */
  causationId?: string;
}

// ─── Idempotency Guard ───

/**
 * Claim a notification for processing by inserting a PENDING NotificationLog
 * row. If the `eventId` already exists (Kafka redelivery), the unique
 * constraint violation (P2002) is caught and the event is treated as
 * already-processed.
 *
 * @returns `{ status: "claimed", logId }` — proceed to render + send.
 *          `{ status: "duplicate" }` — skip, event was already processed.
 *
 * @throws {Error} on any non-duplicate database failure (connection error,
 *   etc.) — the M5 consumer catches this for retry/DLQ routing.
 */
export async function claimNotification(
  input: ClaimNotificationInput,
): Promise<IdempotencyResult> {
  try {
    const log = await prisma.notificationLog.create({
      data: {
        eventId: input.eventId,
        eventType: input.eventType,
        notificationType: input.notificationType,
        recipient: input.recipient,
        status: "PENDING",
        attemptCount: 0,
        maxRetries: 3,
        // Conditional spread avoids passing `undefined` to optional props
        // (exactOptionalPropertyTypes: true).
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.payloadSnapshot !== undefined
          ? {
              payloadSnapshot: input.payloadSnapshot as Prisma.InputJsonValue,
            }
          : {}),
        ...(input.traceparent !== undefined
          ? { traceparent: input.traceparent }
          : {}),
        ...(input.correlationId !== undefined
          ? { correlationId: input.correlationId }
          : {}),
        ...(input.causationId !== undefined
          ? { causationId: input.causationId }
          : {}),
      },
    });

    logger.debug("Notification claimed for processing", {
      logId: log.id,
      eventId: input.eventId,
      eventType: input.eventType,
      recipient: input.recipient,
    });

    return { status: "claimed", logId: log.id };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      logger.info("Duplicate event detected — already processed", {
        eventId: input.eventId,
        eventType: input.eventType,
      });
      return { status: "duplicate" };
    }
    throw error;
  }
}

// ─── Helpers ───

/**
 * Detect a Prisma unique-constraint violation (P2002) without relying solely
 * on `instanceof` — the generated client's error class shape can vary across
 * Prisma versions, so we also duck-type the `code` property as a fallback.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002";
  }
  // Fallback: duck-type the error for non-Prisma runtime edge cases.
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}
