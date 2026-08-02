import createApp from "./app.js";
import config from "./config/index.js";
import logger from "./utils/logger.js";

const port = process.env.PORT || config.port || "3000";

async function main(): Promise<void> {
  try {
    // Create app
    const app = createApp();

    // Start server
    app.listen(port, () => {
      logger.info(`Nexus ${config.serviceName} is listening on port: ${port}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
  }
}

main();
