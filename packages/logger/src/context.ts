import type { Logger } from "./types.js";

/**
 * Correlation identifiers bound once per request so individual log calls don't
 * each have to merge them. `requestId` is standard; `correlationId` /
 * `traceId` are optional for cross-service tracing.
 */
export interface RequestContext {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
}

/**
 * Return a Winston child logger with the given request context bound. Every
 * subsequent log call on the returned logger automatically includes these
 * fields — call sites stop repeating `requestId`/`correlationId`/`traceId`.
 *
 * Safe to call per request: each call produces an independent child scoped to
 * the supplied context, intended for use inside each service's request
 * middleware (bind once, then use the child for the rest of the request).
 */
export function withRequestContext(
  logger: Logger,
  context: RequestContext,
): Logger {
  return logger.child({ ...context }) as Logger;
}
