import type { Request, Response, NextFunction } from "express";
import { NotFoundError } from "@nexus/errors";
import logger from "../utils/logger.js";

/**
 * Service-to-service endpoints are HMAC-signed and have no user session, so they
 * must never be reachable from outside the cluster. They sit under service
 * prefixes that are otherwise public (`/user-service/customers/profile`), so the
 * gateway rejects them before the proxy forwards them.
 *
 * Paths are relative to the service mount point (the mount prefix is stripped by
 * Express before this runs), e.g. `/customers/profile` under `/user-service`.
 */
const INTERNAL_ONLY_PATHS = new Set([
  "/customers/profile",
  "/sellers/profile",
  "/admins/profile",
]);

export const blockInternalOnlyPaths = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!INTERNAL_ONLY_PATHS.has(req.path)) {
    next();
    return;
  }

  logger.warn({
    message: "Blocked internal-only endpoint at the gateway",
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });

  // Deliberately the same 404 a missing route produces: the gateway must not
  // confirm that an internal endpoint exists.
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};
