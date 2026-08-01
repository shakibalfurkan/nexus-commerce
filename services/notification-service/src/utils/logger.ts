import { createLogger } from "@nexus/logger";
import config from "../config/index.js";

const logger = createLogger({
  serviceName: config.serviceName ?? "notification-service",
  node_env: config.node_env ?? "development",
});

export default logger;
