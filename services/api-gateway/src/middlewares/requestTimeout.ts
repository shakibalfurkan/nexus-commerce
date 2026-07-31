import type { Request, Response, NextFunction } from "express";
import { GatewayTimeoutError } from "@nexus/errors";
import { logger } from "../utils/logger.js";

interface RequestTimeoutOptions {
  timeout: number;
  message?: string;
}

export const requestTimeout = (options: RequestTimeoutOptions) => {
  const { timeout, message } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      logger.warn("Request timeout", {
        method: req.method,
        path: req.originalUrl,
        requestId: req.requestId || req.headers["x-request-id"],
        timeout,
      });

      if (!res.headersSent) {
        const error = new GatewayTimeoutError(message || "Request timed out");
        next(error);
      }
    }, timeout);

    res.on("finish", () => {
      clearTimeout(timer);
    });

    next();
  };
};
