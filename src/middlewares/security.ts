import type { Application } from "express";
import helmet from "helmet";
import hpp from "hpp";
import { logger } from "../utils/logger.js";
import config from "../config/index.js";

export const setupSecurityMiddleware = (app: Application): void => {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },

      dnsPrefetchControl: { allow: false },

      frameguard: { action: "deny" },

      hidePoweredBy: true,

      hsts:
        config.node_env === "production"
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,

      noSniff: true,
    }),
  );

  app.use((_req, res, next) => {
    res.setHeader("X-Gateway", "ClassyShop-API-Gateway");

    if (config.node_env === "production") {
      res.setHeader(
        "Permissions-Policy",
        "geolocation=(), microphone=(), camera=()",
      );
    }
    next();
  });

  app.use(hpp());

  app.use((req, res, next) => {
    const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

    if (!allowedMethods.includes(req.method.toUpperCase())) {
      logger.warn({
        message: "Invalid HTTP method attempted",
        method: req.method,
        ip: req.ip,
      });
      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }
    next();
  });

  app.use((req, res, next) => {
    const decodedPath = decodeURIComponent(req.path);

    if (decodedPath.includes("..") || decodedPath.includes("\0")) {
      logger.warn({
        message: "Directory traversal attempt detected",
        path: req.path,
        ip: req.ip,
      });
      return res.status(400).json({
        success: false,
        message: "Invalid request path",
      });
    }
    next();
  });

  logger.info({
    message: "Security middleware configured successfully",
    environment: config.node_env,
  });
};
