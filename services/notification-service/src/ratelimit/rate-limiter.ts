import { createHash, randomUUID } from "node:crypto";

import type { Redis } from "@nexus/redis";
import { TooManyRequestsError } from "@nexus/errors";

import config from "../config/index.js";
import { redis } from "../lib/redis.js";
import logger from "../utils/logger.js";

/**
 * SlidingWindowRateLimiter — Redis-backed rate limiter using a sorted-set
 * (ZSET) per identifier. The check-and-increment is a single atomic Lua
 * script, so there's no race between counting and adding even under
 * concurrent Kafka deliveries.
 *
 * Key namespacing (`.clinerules` §6): all keys live under
 * `notification:ratelimit:` — never a generic key. Recipient emails are
 * SHA-256 hashed before going into the key so no PII lands in Redis.
 *
 * Algorithm (sliding window via ZSET):
 *  1. Remove entries whose score (timestamp) is older than `now - windowMs`.
 *  2. Count remaining entries (ZCARD).
 *  3. If count >= limit → reject, return retryAfterMs (oldest entry + window).
 *  4. Otherwise → ZADD a new entry, set PEXPIRE, return allowed.
 */

const RATE_LIMIT_NAMESPACE = "notification:ratelimit";

/**
 * Atomic Lua script — executed via EVAL. Redis is single-threaded, so the
 * script runs without interruption.
 *
 * KEYS[1] = sorted-set key (e.g. notification:ratelimit:email:email.verification.otp.sent:<hash>)
 * ARGV[1] = now (ms)
 * ARGV[2] = windowMs
 * ARGV[3] = limit
 * ARGV[4] = ttlMs (key expiry — window + buffer)
 * ARGV[5] = unique member suffix (caller-generated UUID — Redis server-side
 *           math.random is not entropy-seeded per-request, so a caller UUID
 *           guarantees ZSET member uniqueness even within the same ms)
 *
 * Returns: { allowed (0/1), count, retryAfterMs }
 */
const SLIDING_WINDOW_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local oldestScore = tonumber(oldest[2]) or 0
  local retryAfter = oldestScore + tonumber(ARGV[2]) - tonumber(ARGV[1])
  if retryAfter < 0 then retryAfter = 0 end
  return {0, count, retryAfter}
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[1] .. ':' .. ARGV[5])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return {1, count + 1, 0}
`;

// ─── Types ───

export interface RateLimitResult {
  /** Whether the request is allowed through. */
  allowed: boolean;
  /** Remaining slots in the current window (0 if rejected). */
  remaining: number;
  /** Configured max requests for the window. */
  limit: number;
  /** Milliseconds until a slot frees up (0 if allowed). */
  retryAfterMs: number;
}

export interface SlidingWindowRateLimiterOptions {
  redis: Redis;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

// ─── Rate Limiter ───

export class SlidingWindowRateLimiter {
  private readonly redis: Redis;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(options: SlidingWindowRateLimiterOptions) {
    this.redis = options.redis;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  /**
   * Check whether the identifier is within the rate limit. If allowed, a
   * slot is consumed atomically.
   *
   * @param identifier — key suffix after the namespace (e.g.
   *   `email:EMAIL_VERIFICATION:<hash>`). The full Redis key is
   *   `notification:ratelimit:<identifier>`.
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${RATE_LIMIT_NAMESPACE}:${identifier}`;
    const now = Date.now();
    const ttlMs = this.windowMs + 1000; // buffer so key survives the window

    const raw = await this.redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      String(now),
      String(this.windowMs),
      String(this.limit),
      String(ttlMs),
      `${now}:${randomUUID()}`,
    );

    // Lua numbers arrive as strings or numbers depending on ioredis version.
    const result = (Array.isArray(raw) ? raw : []) as unknown[];
    const allowed = Number(result[0] ?? 0) === 1;
    const count = Number(result[1] ?? 0);
    const retryAfterMs = Number(result[2] ?? 0);

    if (!allowed) {
      logger.warn("Rate limit exceeded", {
        identifier,
        limit: this.limit,
        count,
        retryAfterMs,
      });
    }

    return {
      allowed,
      remaining: allowed ? this.limit - count : 0,
      limit: this.limit,
      retryAfterMs,
    };
  }

  /**
   * Convenience wrapper that throws `TooManyRequestsError` when the limit is
   * exceeded. The M5 consumer can catch this and let the M4 resilience layer
   * schedule a backoff retry.
   */
  async checkOrThrow(identifier: string): Promise<RateLimitResult> {
    const result = await this.check(identifier);
    if (!result.allowed) {
      throw new TooManyRequestsError(
        `Rate limit exceeded. Retry after ${Math.ceil(result.retryAfterMs / 1000)}s.`,
      );
    }
    return result;
  }
}

// ─── Helpers ───

/**
 * SHA-256 hash a recipient email so no PII is stored in Redis keys.
 * Sufficient for key derivation — not a security boundary.
 */
export function hashRecipient(recipient: string): string {
  return createHash("sha256").update(recipient).digest("hex");
}

/**
 * Build the rate-limit identifier for a recipient + event type.
 * Key shape: `email:<eventType>:<sha256(recipient)>` — namespaced
 * under `notification:ratelimit:` by the limiter.
 */
export function buildRateLimitKey(
  recipient: string,
  eventType: string,
): string {
  return `email:${eventType}:${hashRecipient(recipient)}`;
}

// ─── Factory ───

/**
 * Create a rate limiter from the shared Redis singleton and config.
 * Returns `null` if Redis is not configured — the caller (M5 service layer)
 * decides whether to fail open or hard-error.
 */
export function createRateLimiter(): SlidingWindowRateLimiter | null {
  if (!redis) {
    logger.warn(
      "Rate limiter disabled — Redis not connected. Notifications will not be rate-limited.",
    );
    return null;
  }
  return new SlidingWindowRateLimiter({
    redis,
    limit: config.rateLimit.maxRequests,
    windowMs: config.rateLimit.windowMs,
  });
}
