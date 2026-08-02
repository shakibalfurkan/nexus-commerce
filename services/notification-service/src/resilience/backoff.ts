import config from "../config/index.js";

/**
 * Exponential Backoff + Full Jitter — Calculates retry delays that grow
 * exponentially with a random component to prevent thundering herd.
 *
 * Strategy: "full jitter" (AWS recommended) — returns a random value
 * between 0 and min(baseDelay * 2^attempt, maxDelay). This maximizes
 * the spread of retry times across concurrent consumers.
 *
 * Used by:
 * - `retryWithBackoff()` for immediate in-process retries (e.g. Resend API).
 * - The M5 service layer to calculate `nextRetryAt` for DB-scheduled retries.
 */

// ─── Types ───

export interface BackoffOptions {
  /** Base delay in ms for the first retry (doubles each attempt). */
  baseDelayMs: number;
  /** Maximum delay cap in ms — prevents multi-minute waits on high attempts. */
  maxDelayMs: number;
  /** Maximum number of attempts including the first (default: 3 per .clinerules §6). */
  maxAttempts: number;
}

// ─── Pure Functions ───

/**
 * Calculate the backoff delay for a given attempt using full jitter.
 *
 * @param attempt — zero-based (0 = first retry after initial failure).
 * @returns delay in ms (random between 0 and min(base * 2^attempt, max)).
 */
export function calculateBackoff(
  attempt: number,
  options: BackoffOptions,
): number {
  const exponentialDelay = Math.min(
    options.baseDelayMs * 2 ** attempt,
    options.maxDelayMs,
  );
  return Math.random() * exponentialDelay;
}

/** Promise-based sleep with `setTimeout`. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Retry Wrapper ───

/**
 * Retry an async operation with exponential backoff + full jitter.
 *
 * Only retries when `shouldRetry(error)` returns true — non-retryable errors
 * (e.g. 4xx validation failures) are thrown immediately. The final attempt's
 * error is always thrown. Never retries infinitely (`.clinerules` §6).
 *
 * @param operation — the async function to retry.
 * @param options — backoff parameters.
 * @param shouldRetry — predicate: should this error trigger a retry?
 * @throws the last error if all attempts fail or the error is non-retryable.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: BackoffOptions,
  shouldRetry: (error: unknown) => boolean,
): Promise<T> {
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt === options.maxAttempts - 1;
      if (!shouldRetry(error) || isLastAttempt) {
        throw error;
      }
      await sleep(calculateBackoff(attempt, options));
    }
  }
  // Unreachable when maxAttempts >= 1, but TypeScript needs a terminal throw.
  throw new Error("retryWithBackoff: maxAttempts must be at least 1");
}

// ─── Factory ───

/**
 * Create `BackoffOptions` from the service config.
 */
export function createBackoffOptions(): BackoffOptions {
  return {
    baseDelayMs: config.resilience.backoffBaseMs,
    maxDelayMs: config.resilience.backoffMaxMs,
    maxAttempts: config.resilience.maxAttempts,
  };
}
