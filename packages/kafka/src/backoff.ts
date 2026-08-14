/**
 * Exponential backoff helpers extracted as standalone, pure, unit-testable
 * functions.
 *
 * Unlike `notification-service`'s full-jitter consumer backoff, outbox retries
 * use deterministic exponential growth (`base * 2^count`) capped at
 * `maxBackoffMs`. Determinism matters here because the delay is logged for
 * observation and the actual retry cadence is driven by the poll interval, so
 * randomness would add nothing while making the function hard to test.
 */

/**
 * Calculate the retry backoff delay (ms) for a given retry count.
 *
 * @param retryCount — zero-based (0 = first retry after the initial failure).
 * @param baseBackoffMs — base delay for the first retry (doubles each attempt).
 * @param maxBackoffMs — upper cap so the delay cannot grow unbounded.
 * @returns the capped exponential delay in ms.
 */
export function calculateBackoff(
  retryCount: number,
  baseBackoffMs: number,
  maxBackoffMs: number,
): number {
  const delay = baseBackoffMs * Math.pow(2, retryCount);
  return Math.min(delay, maxBackoffMs);
}

/** Promise-based `setTimeout` sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
