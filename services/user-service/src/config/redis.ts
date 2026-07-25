import { Redis } from "ioredis";
import config from "./index.js";
import logger from "../utils/logger.js";

export const redisClient = new Redis(config.redis_database_url!, {
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    logger.warn(
      `Redis disconnected. Reconnecting in ${delay}ms... (Attempt ${times})`,
    );
    return delay;
  },
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
});

redisClient.on("error", (err) => {
  logger.error("Redis Engine Error", { error: err.message });
});

redisClient.on("ready", () => {
  logger.info("Redis Engine (ioredis) connected and operational.");
});
