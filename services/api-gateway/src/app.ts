import express, {
  type Application,
  type Request,
  type Response,
} from "express";

import morgan from "morgan";
import compression from "compression";

import { setupSecurityMiddleware } from "./middlewares/security.js";
import { requestIdMiddleware } from "./middlewares/requestId.js";
import config from "./config/index.js";
import { createLogger, createMorganStream } from "@nexus/logger";
import { circuitBreakerMiddleware } from "./middlewares/circuitBreaker.js";
import notFoundHandler from "./middlewares/notFound.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import { corsMiddleware } from "./middlewares/cors.js";
import { globalLimiter } from "./middlewares/rateLimiter.js";
import { registerProxies } from "./middlewares/proxy.js";
import { requestTimeout } from "./middlewares/requestTimeout.js";
import { formatUptime } from "@nexus/shared-utils";

function createApp(): Application {
  const logger = createLogger({
    serviceName: config.serviceName,
    node_env: config.node_env,
  });
  const morganStream = createMorganStream(logger);

  const app: Application = express();
  app.set("trust proxy", 1);

  // ─── Security
  setupSecurityMiddleware(app);

  // ─── Compression (only for text-based responses)
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
      threshold: 1024,
    }),
  );

  // ─── Request ID
  app.use(requestIdMiddleware);

  // ─── Logging
  if (config.node_env === "production") {
    app.use(morgan("combined", { stream: morganStream }));
  } else {
    app.use(morgan("dev"));
  }

  // ─── CORS
  app.use(corsMiddleware);

  // ─── Rate Limiting
  app.use(globalLimiter);

  // ─── Request Timeout (29s — before proxy timeout of 30s)
  // Staggered 1s before proxy ceiling to prevent infrastructure race conditions
  app.use(requestTimeout({ timeout: config.proxy_timeout - 1000 }));

  // ─── Circuit Breaker
  app.use(circuitBreakerMiddleware);

  // ─── Proxies
  registerProxies(app);

  // ─── Body Parsing (only for non-proxied routes)
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // ─── Routes
  app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: `Welcome to Nexus ${config.serviceName} API!`,
    });
  });

  app.get("/health", async (_req: Request, res: Response) => {
    const healthData: Record<string, any> = {
      success: true,
      message: "Service is healthy",
      timestamp: new Date().toISOString(),
      uptime: formatUptime(process.uptime()),
      service: config.serviceName,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };

    res.status(200).json(healthData);
  });

  // ─── Error Handling
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

export default createApp;
