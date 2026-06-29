import {
  createProxyMiddleware,
  type RequestHandler,
} from "http-proxy-middleware";
import type { Request, Response } from "express";
import type { Application } from "express";
import type { IncomingMessage } from "http";
import { ServerResponse } from "http";
import type { Socket } from "net";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ServiceUnavailableError } from "../errors/AppError.js";

const buildProxy = (serviceUrl: string): RequestHandler =>
  createProxyMiddleware({
    target: serviceUrl,
    changeOrigin: true,

    on: {
      proxyReq: (proxyReq, req: IncomingMessage) => {
        const expressReq = req as Request;

        proxyReq.setHeader(
          "X-Request-ID",
          (expressReq.headers["x-request-id"] ||
            expressReq.requestId) as string,
        );
        proxyReq.setHeader("X-Forwarded-For", expressReq.ip || "");

        logger.debug(
          `→ Proxying ${expressReq.method} ${expressReq.originalUrl} → ${serviceUrl}${expressReq.url}`,
        );
      },

      proxyRes: (proxyRes, req: IncomingMessage) => {
        const expressReq = req as Request;

        logger.info("← Proxy response", {
          requestId: expressReq.headers["x-request-id"],
          path: expressReq.originalUrl,
          statusCode: proxyRes.statusCode,
        });
      },

      error: (
        err: Error,
        _req: IncomingMessage,
        res: ServerResponse | Socket,
      ) => {
        logger.error("Proxy error", { message: err.message });

        if (res instanceof ServerResponse) {
          const response = res as Response;
          const error = new ServiceUnavailableError();

          response.status(error.statusCode || 503).json({
            success: false,
            message: error.message,
          });
        }
      },
    },
  });

export const registerProxies = (app: Application): void => {
  app.use("/auth-service", buildProxy(config.auth_service_url!));
  app.use("/user-service", buildProxy(config.user_service_url!));
};
