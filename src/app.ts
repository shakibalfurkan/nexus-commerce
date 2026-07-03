import express, {
  type Application,
  type Request,
  type Response,
} from "express";

import cors from "cors";
import cookieParser from "cookie-parser";

import config from "./config/index.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import notFoundHandler from "./middlewares/notFound.js";
import helmet from "helmet";
import morgan from "morgan";
import formatUptime from "./utils/formatUptime.js";

import { morganStream } from "./utils/logger.js";
import globalRouter from "./routes/index.js";
import { requestIdMiddleware } from "./middlewares/requestId.js";

export function createApp(): Application {
  const app: Application = express();

  // Middleware setup
  app.use(helmet());

  app.use(requestIdMiddleware);
  app.use(
    cors({
      origin: config.allowed_origins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  if (config.node_env === "production") {
    app.use(morgan("combined", { stream: morganStream }));
  } else {
    app.use(morgan("dev"));
  }

  app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: `Welcome to the ClassyShop ${config.serviceName} API!`,
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Service is healthy",
      timestamp: new Date().toISOString(),
      uptime: formatUptime(process.uptime()),
      service: config.serviceName,
    });
  });

  app.use("/api/v1", globalRouter);

  app.use(notFoundHandler);

  app.use(globalErrorHandler);

  return app;
}
