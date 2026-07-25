import { redisClient } from "../config/redis.js";
import { CircuitBreaker } from "./circuitBreaker.js";
import { TTL, negativeCacheKey } from "./cacheKeys.js";
import logger from "../utils/logger.js";

// ─── L1: In-Memory LRU Cache ───
// Simple Map-based implementation with TTL expiration.
// For higher throughput, replace with `lru-cache` package.

interface L1Entry<T> {
  value: T;
  expiresAt: number;
}

class L1Cache {
  private store = new Map<string, L1Entry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    // Evict oldest entry if at capacity
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// ─── Singleton L1 Cache Instance ───

const l1Cache = new L1Cache(1000);

// ─── Redis Circuit Breaker ───

const redisCircuitBreaker = new CircuitBreaker({
  name: "redis",
  failureThreshold: 5,
  failureWindowMs: 10_000,
  resetTimeoutMs: 30_000,
  halfOpenMaxRetries: 3,
  enableLogging: true,
});

// ─── Public API ───

export interface CacheGetOptions {
  l2Ttl?: number;
  l1TtlMs?: number;
  useNegativeCache?: boolean;
}

const DEFAULT_OPTIONS: Required<CacheGetOptions> = {
  l2Ttl: TTL.DEFAULT,
  l1TtlMs: 100,
  useNegativeCache: true,
};

export async function cacheGet<T>(
  key: string,
  fetch: () => Promise<T | null>,
  options: CacheGetOptions = {},
): Promise<T | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ─── L1: In-Memory Check ───
  const l1Result = l1Cache.get<T>(key);
  if (l1Result !== undefined) {
    return l1Result;
  }

  // Check negative cache in L1
  const negativeKey = negativeCacheKey(key);
  const l1Negative = l1Cache.get<true>(negativeKey);
  if (l1Negative !== undefined) {
    return null;
  }

  // ─── L2: Redis Check (with Circuit Breaker) ───
  try {
    const l2Result = await redisCircuitBreaker.execute(async () => {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
      return null;
    });

    if (l2Result !== null) {
      // Populate L1
      l1Cache.set(key, l2Result, opts.l1TtlMs);
      return l2Result;
    }

    // Check negative cache in L2
    const l2Negative = await redisCircuitBreaker.execute(async () => {
      const cached = await redisClient.get(negativeKey);
      return cached ? true : null;
    });

    if (l2Negative) {
      l1Cache.set(negativeKey, true as const, opts.l1TtlMs);
      return null;
    }
  } catch (error) {
    // Circuit breaker is OPEN or Redis is down — fall through to DB
    logger.warn(
      `[Cache] L2 (Redis) unavailable for key: ${key}. Falling through to DB.`,
    );
  }

  // ─── L3: Database Fetch ───
  const result = await fetch();

  // Populate caches on the way back
  if (result !== null) {
    // Populate L2 (Redis) — with circuit breaker protection
    try {
      await redisCircuitBreaker.execute(async () => {
        await redisClient.setex(key, opts.l2Ttl, JSON.stringify(result));
      });
    } catch {
      logger.warn(`[Cache] Failed to write to L2 (Redis) for key: ${key}.`);
    }

    // Populate L1 (in-memory)
    l1Cache.set(key, result, opts.l1TtlMs);
  } else if (opts.useNegativeCache) {
    // Cache the "not found" result to prevent cache stampede
    try {
      await redisCircuitBreaker.execute(async () => {
        await redisClient.setex(negativeKey, TTL.NEGATIVE_CACHE, "1");
      });
    } catch {
      logger.warn(
        `[Cache] Failed to write to L2 (Redis) for negative key: ${negativeKey}.`,
      );
    }
    l1Cache.set(negativeKey, true as const, opts.l1TtlMs);
  }

  return result;
}

export async function cacheInvalidate(key: string): Promise<void> {
  // Invalidate L1 (in-memory)
  l1Cache.del(key);
  l1Cache.del(negativeCacheKey(key));

  // Invalidate L2 (Redis) — with circuit breaker protection
  try {
    await redisCircuitBreaker.execute(async () => {
      await redisClient.del(key);
      await redisClient.del(negativeCacheKey(key));
    });
  } catch {
    logger.warn(`[Cache] Failed to invalidate L2 (Redis) for key: ${key}.`);
  }
}

export async function cacheInvalidateMany(keys: string[]): Promise<void> {
  await Promise.all(keys.map(cacheInvalidate));
}

export function clearL1Cache(): void {
  l1Cache.clear();
}

export function getRedisCircuitState() {
  return redisCircuitBreaker.getMetrics();
}
