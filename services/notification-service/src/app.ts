import express, {
  type Application,
  type Request,
  type Response,
} from "express";

import config from "./config/index.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import notFoundHandler from "./middlewares/notFound.js";
import helmet from "helmet";

import formatUptime from "./utils/formatUptime.js";

function createApp(): Application {
  const app: Application = express();

  // Middleware setup
  app.use(helmet());

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

  app.use(notFoundHandler);

  app.use(globalErrorHandler);

  return app;
}

export default createApp;
