import type { NextFunction, Request, Response } from "express";
import config from "../config/index.js";
import { ForbiddenError, UnauthorizedError } from "@nexus/errors";
import verifyToken from "../utils/token/verifyToken.js";
import { UserRoles } from "../generated/prisma/enums.js";

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token =
    req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

  if (!token) {
    throw new UnauthorizedError("You are not authorized!");
  }

  const decoded = verifyToken(token, config.jwt.access_token_secret, "access");

  if (!decoded.activeRole) {
    throw new UnauthorizedError("Invalid access token");
  }

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.activeRole,
  };
  next();
}

/**
 * Role gate for authenticated routes. Checks the session's active role (the
 * role the user signed in with on this surface), so a customer-app session can
 * never satisfy an admin-only route even for a dual-role account.
 *
 * Usage: `requireRole(UserRoles.SUPER_ADMIN)`
 */
export function requireRole(...allowedRoles: UserRoles[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const activeRole = req.user?.role;

    if (!activeRole || !allowedRoles.includes(activeRole)) {
      throw new ForbiddenError(
        "You do not have permission to perform this action",
      );
    }

    next();
  };
}
