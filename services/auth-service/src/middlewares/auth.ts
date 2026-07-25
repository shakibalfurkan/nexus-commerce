import type { Request, Response, NextFunction } from "express";
import config from "../config/index.js";
import { UnauthorizedError } from "../errors/AppError.js";
import verifyToken, { type IDecodedToken } from "../utils/token/verifyToken.js";
import type { JwtPayload } from "jsonwebtoken";

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

  const decoded = verifyToken(
    token,
    config.jwt.access_token_secret!,
  ) as JwtPayload;

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.activeRole,
  };
  next();
}
