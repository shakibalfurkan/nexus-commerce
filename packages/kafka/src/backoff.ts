// Calculate the retry backoff delay (ms) for a given retry count.
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
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}
