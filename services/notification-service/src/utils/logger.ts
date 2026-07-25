import path from "path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import config from "../config/index.js";

const consoleFormat = winston.format.combine(
  winston.format.colorize({
    all: true,
  }),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : "";
    return `${timestamp} ${level}: ${message}${metaStr}`;
  }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const transports: winston.transport[] = [];

// Always log to console
transports.push(
  new winston.transports.Console({
    format: config.isDevelopment ? consoleFormat : fileFormat,
  }),
);

// File logging (not for serverless environments like Vercel)
const isServerless =
  process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME;

if (!isServerless) {
  transports.push(
    new DailyRotateFile({
      filename: path.join(process.cwd(), "logs", "successes", "app-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "info",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      format: fileFormat,
    }),
  );

  // transports.push(
  //   new DailyRotateFile({
  //     filename: path.join(process.cwd(), "logs", "http", "http-%DATE%.log"),
  //     datePattern: "YYYY-MM-DD",
  //     level: "http",
  //     zippedArchive: true,
  //     maxSize: "50m",
  //     maxFiles: "7d",
  //     format: fileFormat,
  //   }),
  // );

  // Error logs (warn, error)
  transports.push(
    new DailyRotateFile({
      filename: path.join(process.cwd(), "logs", "errors", "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "warn",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
      format: fileFormat,
    }),
  );
}

export const logger = winston.createLogger({
  level: config.isDevelopment ? "debug" : "info",
  defaultMeta: {
    service: config.serviceName,
    env: config.node_env,
  },
  transports,
  exitOnError: false,
});

// export const morganStream = {
//   write: (message: string) => logger.http(message.trim()),
// };

process.on("unhandledRejection", (reason: Error) => {
  logger.error("Unhandled Promise Rejection", {
    error: reason.message,
    stack: reason.stack,
  });
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });

  setTimeout(() => {
    console.error("Process will exit due to uncaught exception");
    process.exit(1);
  }, 1000);
});

export default logger;
