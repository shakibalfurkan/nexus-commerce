import type { Request } from "express";
import type { IRequestContext } from "../modules/auth/auth.interface.js";

/**
 * Reads the client surface + request provenance once, so every role controller
 * doesn't re-implement the header/forwarded-for extraction.
 */
export function readRequestContext(req: Request): IRequestContext {
  const xForwardedFor = req.headers["x-forwarded-for"];

  return {
    clientType: req.headers["x-client-type"] as string | undefined,
    ipAddress: Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : (xForwardedFor ?? req.socket.remoteAddress ?? undefined),
    userAgent: req.headers["user-agent"] as string | undefined,
  };
}
