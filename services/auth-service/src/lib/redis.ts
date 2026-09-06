import { createRedisClient, type Redis } from "@nexus/redis";
import config from "../config/index.js";
import logger from "../utils/logger.js";
import { InternalServerError } from "@nexus/errors";

const redisUrl = config.redis.url!;

let redis: Redis = createRedisClient({
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
