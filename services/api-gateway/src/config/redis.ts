import { createRedisClient, type Redis } from "@nexus/redis";
import config from "./index.js";

export const redisClient: Redis = createRedisClient({
  url: config.redis_database_url,
  serviceName: config.serviceName,
  node_env: config.node_env,
});
