import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const requestId =
    (req.headers["x-request-id"] as string) || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
};
