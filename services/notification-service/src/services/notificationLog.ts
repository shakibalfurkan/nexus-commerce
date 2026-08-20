import { prisma } from "../lib/prisma.js";
import {
  calculateBackoff,
  type BackoffOptions,
} from "../resilience/backoff.js";
import logger from "../utils/logger.js";

/**
 * NotificationLog infrastructure functions — DB operations for updating
 * notification status after the idempotency claim. These are infrastructure
 * adapters (they use Prisma directly); the service layer calls them by
 * function signature, never importing Prisma itself.
 */

/**
 * Mark a notification as successfully sent.
 */
export async function markAsSent(
  logId: string,
  providerMessageId: string,
): Promise<void> {
  await prisma.notificationLog.update({
    where: { id: logId },
    data: {
      status: "SENT",
      providerMessageId,
      processedAt: new Date(),
      lastAttemptAt: new Date(),
    },
  });
  logger.debug("Notification marked as SENT", { logId, providerMessageId });
}

/**
 * Mark a notification as failed and schedule a retry.
 * Increments `attemptCount` and returns the updated values so the caller
 * can check if `maxRetries` is exceeded and route to DLQ.
 *
 * `nextRetryAt` is computed from the actual attempt count so the backoff
 * grows exponentially across retries (attempt 0 → base, attempt 1 → 2x, ...).
 */
export async function markAsFailed(
  logId: string,
  errorMessage: string,
  backoffOptions: BackoffOptions,
): Promise<{ attemptCount: number; maxRetries: number }> {
  // Read the current count so the next retry index (0-based) is correct.
  const current = await prisma.notificationLog.findUnique({
    where: { id: logId },
    select: { attemptCount: true },
  });
  const nextAttemptIndex = (current?.attemptCount ?? 0) + 1;
  const nextRetryAt = new Date(
    Date.now() + calculateBackoff(nextAttemptIndex, backoffOptions),
  );

  const updated = await prisma.notificationLog.update({
    where: { id: logId },
    data: {
      status: "FAILED",
      lastError: errorMessage,
      lastAttemptAt: new Date(),
      nextRetryAt,
      attemptCount: { increment: 1 },
    },
    select: { attemptCount: true, maxRetries: true },
  });

  logger.warn("Notification marked as FAILED", {
    logId,
    errorMessage,
    attemptCount: updated.attemptCount,
    maxRetries: updated.maxRetries,
    nextRetryAt: nextRetryAt.toISOString(),
  });

  return updated;
}
