import type { Request, Response, NextFunction } from "express";
import { redisClient } from "../config/redis.js";
import { AppError } from "../errors/AppError.js";
import logger from "../utils/logger.js";

interface RateLimiterOptions {
  windowSeconds?: number;
  maxRequests?: number;
  route: string;
  prefix?: string;
}

const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(opts: RateLimiterOptions) {
  const {
    windowSeconds = 60,
    maxRequests = 10,
    prefix = "auth:rl",
    route,
  } = opts;

  return async (req: Request, _res: Response, next: NextFunction) => {
    const key = `${prefix}:${route}:${req.headers["x-forwarded-for"] ?? "unknown"}`;
    const now = Date.now();

    try {
      // Try Redis first
      const current = await redisClient.get(key);
      const count = current ? Number(current) : 0;

      if (count >= maxRequests) {
        throw new AppError(429, `Too many requests. Try again later.`);
      }

      if (count === 0) {
        await redisClient.setex(key, windowSeconds, "1");
      } else {
        await redisClient.incr(key);
      }

      next();
    } catch (err) {
      // If Redis failed, fall back to in-memory store
      if (err instanceof AppError) {
        next(err);
        return;
      }

      logger.warn(
        `[RateLimiter] Redis unavailable — falling back to in-memory store`,
      );

      const entry = inMemoryStore.get(key);
      if (entry && entry.resetAt > now) {
        entry.count += 1;
        if (entry.count > maxRequests) {
          next(new AppError(429, `Too many requests. Try again later.`));
          return;
        }
      } else {
        inMemoryStore.set(key, {
          count: 1,
          resetAt: now + windowSeconds * 1000,
        });
      }

      next();
    }
  };
}
