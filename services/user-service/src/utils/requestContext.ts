import type { Request } from "express";

export interface RequestContext {
  ipAddress: string | undefined;
  userAgent: string | undefined;
}

/**
 * Reads request provenance once so every role controller doesn't re-implement
 * the `x-forwarded-for` / user-agent extraction for audit entries.
 */
export function readRequestContext(req: Request): RequestContext {
  const xForwardedFor = req.headers["x-forwarded-for"];

  return {
    ipAddress: Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : (xForwardedFor ?? req.socket.remoteAddress ?? undefined),
    userAgent: req.headers["user-agent"] as string | undefined,
  };
}
