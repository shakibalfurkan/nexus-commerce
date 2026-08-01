import { createRedisClient } from "@nexus/redis";
import config from "./index.js";

export const redisClient = createRedisClient({
  url: config.redis_database_url,
  serviceName: config.serviceName,
  node_env: config.node_env,
});
