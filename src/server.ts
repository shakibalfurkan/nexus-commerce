import createApp from "./app.js";
import config from "./config/index.js";
import { redisClient } from "./config/redis.js";
import logger from "./utils/logger.js";

async function main() {
  const port = process.env.PORT || config.port;

  try {
    const app = createApp();

    await redisClient.ping();
    logger.info("Redis Database handshake verified successfully.");

    app.listen(port, () => {
      logger.info(
        `ClassyShop ${config.serviceName} is running on port ${port}`,
      );
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
  }
}

main();
