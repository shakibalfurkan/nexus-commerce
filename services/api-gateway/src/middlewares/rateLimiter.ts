import rateLimit from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { TooManyRequestsError } from "@nexus/errors";
import { redisClient } from "../config/redis.js";
import config from "../config/index.js";

const onLimitReached = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  logger.warn("Rate limit exceeded", {
    ip: req.ip,
    path: req.path,
    method: req.method,
    requestId: req.requestId || req.headers["x-request-id"],
  });

  return next(
    new TooManyRequestsError(
      "Too many requests. Please slow down and try again later.",
    ),
  );
};

export const globalLimiter = rateLimit({
  windowMs: config.rate_limit_window_ms,
  max: config.rate_limit_max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: onLimitReached,

  store: new RedisStore({
    sendCommand: async (
      command: string,
      ...args: string[]
    ): Promise<RedisReply> => {
      try {
        return (await redisClient.call(command, ...args)) as RedisReply;
      } catch (error) {
        logger.error(
          "Redis store connection fault. Falling back to fail-open routing:",
          error,
        );

        if (command.toLowerCase() === "script") {
          return "" as unknown as RedisReply;
        }

        return [0, 60_000] as unknown as RedisReply;
      }
    },

    prefix: "gateway:ratelimit:",
  }),
});
