import { createRedisClient, type Redis } from "@nexus/redis";
import config from "../config/index.js";
import logger from "../utils/logger.js";

const redisUrl = config.redis.url!;

/**
 * Shared Redis client (cache L2, rate limiter, idempotency keys).
 *
 * Non-null like auth-service's client: the resource is instantiated here (not
 * in `config/`) because it owns a connection lifecycle, and consumers rely on
 * it being present rather than null-checking a misconfiguration at every call
 * site. ioredis retries in the background; callers that must survive a Redis
 * outage (cache, rate limiter) already catch and degrade.
 */
const redis: Redis = createRedisClient({
  url: redisUrl,
  serviceName: config.serviceName,
  node_env: config.node_env,
});

/**
 * Gracefully close the Redis connection (called on shutdown).
 */
async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      logger.info("Redis disconnected.");
    } catch (err) {
      logger.error("Error disconnecting Redis:", err);
    }
  }
}

export { redis, disconnectRedis };
