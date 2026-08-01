import { Redis } from "ioredis";
import { createLogger } from "@nexus/logger";

export interface RedisClientOptions {
  url: string;
  serviceName: string;
  node_env: string;
}

export function createRedisClient(options: RedisClientOptions): Redis {
  const logger = createLogger({
    serviceName: options.serviceName,
    node_env: options.node_env,
  });

  const client = new Redis(options.url, {
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

  client.on("error", (err) => {
    logger.error("Redis Engine Error", { error: err.message });
  });

  client.on("ready", () => {
    logger.info("Redis Engine (ioredis) connected and operational.");
  });

  return client;
}
