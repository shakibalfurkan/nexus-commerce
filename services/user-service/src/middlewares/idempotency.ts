import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { redis as redisClient } from "../lib/redis.js";
import logger from "../utils/logger.js";
import sendResponse from "../utils/sendResponse.js";

// ─── Constants ───

const IDEMPOTENCY_TTL = 86_400;
const PROCESSING_TTL = 30;
const IDEMPOTENCY_HEADER = "X-Idempotency-Key" as const;

// ─── Redis Key Prefix ───

function idempotencyKey(key: string): string {
  return `idempotency:${key}`;
}

// ─── Middleware ───

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    next();
    return;
  }

  const key = req.headers[IDEMPOTENCY_HEADER.toLowerCase()] as
    | string
    | undefined;

  if (!key) {
    req.idempotencyKey = uuidv4();
    next();
    return;
  }

  req.idempotencyKey = key;
  const redisKey = idempotencyKey(key);

  try {
    const existing = await redisClient.get(redisKey);

    if (existing) {
      const cached = JSON.parse(existing) as {
        statusCode: number;
        success: boolean;
        body: unknown;
      };

      logger.info(`[Idempotency] Replaying cached response for key: ${key}`);

      sendResponse(res, {
        statusCode: cached.statusCode,
        success: cached.statusCode < 400,
        data: cached.body,
      });
      return;
    }

    const processingKey = `${redisKey}:processing`;
    const acquired = await redisClient.set(
      processingKey,
      "1",
      "PX",
      PROCESSING_TTL * 1000,
      "NX",
    );

    if (!acquired) {
      sendResponse(res, {
        statusCode: 409,
        success: false,
        message:
          "Another request with the same Idempotency-Key is currently being processed. Please try again later.",
        data: null,
      });
      return;
    }

    // Store the original send function to intercept the response
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      // Store the response in Redis with TTL
      const responseData = {
        statusCode: res.statusCode,
        success: res.statusCode < 400,
        body,
      };

      redisClient
        .setex(redisKey, IDEMPOTENCY_TTL, JSON.stringify(responseData))
        .catch((err: unknown) => {
          logger.error("[Idempotency] Failed to cache response", err);
        });

      // Clean up the processing marker
      redisClient.del(processingKey).catch(() => {});

      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.warn(
      "[Idempotency] Redis unavailable, proceeding without idempotency protection",
    );
    next();
  }
}
