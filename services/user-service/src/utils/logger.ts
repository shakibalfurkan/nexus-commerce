import { createLogger } from "@nexus/logger";
import config from "../config/index.js";

const logger = createLogger({
  serviceName: config.serviceName,
  node_env: config.node_env,
});

export default logger;
