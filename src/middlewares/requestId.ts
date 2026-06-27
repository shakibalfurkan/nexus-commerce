import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let requestId = req.headers["x-request-id"] as string;

  if (!requestId) {
    requestId = randomUUID();
  }

  req.headers["x-request-id"] = requestId;
  req.requestId = requestId;

  res.setHeader("X-Request-ID", requestId);

  next();
};
