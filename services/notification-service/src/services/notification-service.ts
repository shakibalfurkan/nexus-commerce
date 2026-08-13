import type { EmailProvider } from "../providers/email-provider.interface.js";
import { EmailProviderError } from "../providers/email-provider.error.js";
import type { SlidingWindowRateLimiter } from "../ratelimit/rate-limiter.js";
import { buildRateLimitKey } from "../ratelimit/rate-limiter.js";
import type { CircuitBreaker } from "../resilience/circuit-breaker.js";
import { retryWithBackoff } from "../resilience/backoff.js";
import type { BackoffOptions } from "../resilience/backoff.js";
import { claimNotification } from "../idempotency/idempotency.js";
import type { ClaimNotificationInput } from "../idempotency/idempotency.js";
import { markAsSent, markAsFailed } from "./notification-log.js";
import { routeToDlq } from "./dlq.js";
import {
  isHandledDomainEvent,
  getEventRegistryEntry,
} from "../events/domain-event.schemas.js";
import { isTemplateKey, renderTemplate } from "../templates/template-engine.js";
import type { IncomingNotificationMessage } from "../types/kafka-message.types.js";
import logger from "../utils/logger.js";

/**
 * NotificationService — Clean architecture domain layer that orchestrates
 * the full notification flow.
 *
 * Dependencies are injected (`.clinerules` §4): the service depends on
 * interfaces (EmailProvider, CircuitBreaker, RateLimiter), never on
 * concrete vendor SDKs or infrastructure (Prisma, Kafka, Resend). Those
 * live in adapter modules called by function signature.
 *
 * Flow:
 *  1. Look up event in domainEventRegistry → templateKey, recipient, subject.
 *  2. Claim idempotency (create PENDING NotificationLog). Duplicate → skip.
 *  3. Check rate limit (Redis sliding window). Exceeded → mark FAILED, return.
 *  4. Render template (React Email → HTML).
 *  5. Send email via CircuitBreaker + retryWithBackoff (max 3 attempts).
 *  6. On success → mark SENT.
 *  7. On failure → mark FAILED, check maxRetries → route to DLQ if exhausted.
 *
 * Error strategy:
 * - Errors BEFORE log creation (parse, claim) → throw (KafkaJS redelivers).
 * - Errors AFTER log creation (rate limit, render, send) → catch, mark
 *   FAILED, return result (no throw — the log tracks status for retry).
 */

// ─── Types ───

export interface NotificationServiceDeps {
  emailProvider: EmailProvider;
  rateLimiter: SlidingWindowRateLimiter | null;
  circuitBreaker: CircuitBreaker;
  backoffOptions: BackoffOptions;
}

export type ProcessEventResult =
  | { status: "sent"; logId: string }
  | { status: "skipped"; reason: "unhandled" | "duplicate" }
  | {
      status: "failed";
      logId: string;
      error: string;
      routedToDlq: boolean;
    };

// ─── Helpers ───

/** Only retryable email errors (5xx, 429, network) should trigger retries. */
function isRetryableEmailError(error: unknown): boolean {
  return error instanceof EmailProviderError && error.retryable;
}

// ─── Service ───

export class NotificationService {
  private readonly deps: NotificationServiceDeps;

  constructor(deps: NotificationServiceDeps) {
    this.deps = deps;
  }

  async processEvent(
    message: IncomingNotificationMessage,
  ): Promise<ProcessEventResult> {
    const { event, traceparent, correlationId } = message;

    // 1. Look up event in registry
    if (!isHandledDomainEvent(event.eventName)) {
      logger.warn("Unhandled domain event", {
        eventName: event.eventName,
        aggregateId: event.aggregateId,
      });
      return { status: "skipped", reason: "unhandled" };
    }

    const entry = getEventRegistryEntry(event.eventName);
    // TypeScript can't verify the correlated-union at this call site
    // (https://github.com/microsoft/TypeScript/issues/30581). The registry
    // guarantees the correct function is called for the correct event type.
    const recipient = entry.extractRecipient(event as never);
    const subject = entry.getSubject(event as never);

    // 2. Claim idempotency — throws on non-duplicate DB errors (before log)
    const claimInput: ClaimNotificationInput = {
      eventId: event.aggregateId,
      eventType: event.eventName,
      recipient,
      subject,
      payloadSnapshot: event,
      ...(traceparent !== undefined ? { traceparent } : {}),
      ...(correlationId !== undefined ? { correlationId } : {}),
    };

    const claimResult = await claimNotification(claimInput);

    if (claimResult.status === "duplicate") {
      logger.info("Duplicate event skipped", {
        eventId: event.aggregateId,
        eventType: event.eventName,
      });
      return { status: "skipped", reason: "duplicate" };
    }

    const logId = claimResult.logId;

    // All errors from here are AFTER log creation — catch and mark FAILED.
    try {
      // 3. Check rate limit
      if (this.deps.rateLimiter) {
        const rateLimitKey = buildRateLimitKey(recipient, event.eventName);
        const rateLimitResult = await this.deps.rateLimiter.check(rateLimitKey);
        if (!rateLimitResult.allowed) {
          const { attemptCount, maxRetries } = await markAsFailed(
            logId,
            `Rate limit exceeded. Retry after ${Math.ceil(rateLimitResult.retryAfterMs / 1000)}s.`,
            this.deps.backoffOptions,
          );
          const routedToDlq = attemptCount >= maxRetries;
          if (routedToDlq) {
            await routeToDlq({
              logId,
              eventId: event.aggregateId,
              eventType: event.eventName,
              recipient,
              payload: event,
              failureReason: "Rate limit exceeded — max retries exhausted",
              attemptCount,
              ...(traceparent !== undefined ? { traceparent } : {}),
              ...(correlationId !== undefined ? { correlationId } : {}),
            });
          }
          return {
            status: "failed",
            logId,
            error: "Rate limit exceeded",
            routedToDlq,
          };
        }
      }

      // 4. Render template
      if (!isTemplateKey(entry.templateKey)) {
        throw new Error(`Unknown template key: ${entry.templateKey}`);
      }

      const { html } = await renderTemplate(
        entry.templateKey,
        // The registry guarantees the payload matches the template props,
        // but TypeScript can't verify the correlated-union at this call
        // site (https://github.com/microsoft/TypeScript/issues/30581).
        event.payload as never,
      );

      // 5. Send email via circuit breaker + retryWithBackoff
      const sendResult = await this.deps.circuitBreaker.execute(() =>
        retryWithBackoff(
          () =>
            this.deps.emailProvider.send({
              to: recipient,
              subject,
              html,
            }),
          this.deps.backoffOptions,
          isRetryableEmailError,
        ),
      );

      // 6. Mark as sent
      await markAsSent(logId, sendResult.messageId);

      logger.info("Notification sent successfully", {
        logId,
        eventId: event.aggregateId,
        eventType: event.eventName,
        recipient,
        providerMessageId: sendResult.messageId,
      });

      return { status: "sent", logId };
    } catch (error) {
      // 7. Handle failure — mark FAILED, check maxRetries → DLQ
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const { attemptCount, maxRetries } = await markAsFailed(
        logId,
        errorMessage,
        this.deps.backoffOptions,
      );

      const routedToDlq = attemptCount >= maxRetries;
      if (routedToDlq) {
        await routeToDlq({
          logId,
          eventId: event.aggregateId,
          eventType: event.eventName,
          recipient,
          payload: event,
          failureReason: errorMessage,
          attemptCount,
          ...(traceparent !== undefined ? { traceparent } : {}),
          ...(correlationId !== undefined ? { correlationId } : {}),
        });
      }

      logger.error("Notification processing failed", {
        logId,
        eventId: event.aggregateId,
        eventType: event.eventName,
        error: errorMessage,
        attemptCount,
        maxRetries,
        routedToDlq,
      });

      return {
        status: "failed",
        logId,
        error: errorMessage,
        routedToDlq,
      };
    }
  }
}
