import type { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync.js";
import { UserRoles } from "../generated/prisma/enums.js";
import { ForbiddenError, UnauthorizedError } from "@nexus/errors";
import config from "../config/index.js";
import verifyToken from "../utils/token/verifyToken.js";

/**
 * JWT auth + role gate. Roles are enforced from the verified access token
 * itself (auth-service is the authority that signs them); no per-request user
 * lookup — user-service data can't be used to authenticate a call to
 * user-service anyway.
 *
 * Usage: `auth(UserRoles.ADMIN, UserRoles.SUPER_ADMIN)`
 */
export const auth = (...requiredRoles: UserRoles[]) => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token =
      req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new UnauthorizedError("You are not authorized!");
    }

    const decoded = verifyToken(token, config.jwt.access_token_secret!, "access");

    if (
      requiredRoles.length > 0 &&
      !decoded.role.some((role) => requiredRoles.includes(role))
    ) {
      throw new ForbiddenError("You do not have permission to perform this action");
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  });
};
