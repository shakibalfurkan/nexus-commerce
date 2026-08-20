import path from "path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { consoleFormat, fileFormat } from "./format.js";
import type { LoggerConfig } from "./types.js";

/**
 * Build the transport list for a logger instance.
 *
 * The Console transport is ALWAYS present and is the primary transport in
 * production — on every one of this project's hosting targets (Render free-tier
 * containers, and any serverless platform) the filesystem is EPHEMERAL. Files
 * written under `process.cwd()/logs/...` are discarded on every redeploy or
 * restart, so writing them is wasted disk I/O and open file handles for logs
 * that are never retained.
 *
 * File (DailyRotateFile) transports are therefore OPT-IN only: they are
 * constructed solely when `ENABLE_FILE_LOGGING=true` is explicitly set — e.g.
 * for local development where the developer wants on-disk logs. They default
 * OFF. Do NOT re-enable them unconditionally for "production"; ship logs to a
 * real aggregator from stdout instead.
 */
export function buildTransports(config: LoggerConfig): winston.transport[] {
  const isDevelopment =
    config.isDevelopment ?? config.node_env === "development";

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: isDevelopment ? consoleFormat : fileFormat,
    }),
  ];

  const fileLoggingEnabled =
    process.env.ENABLE_FILE_LOGGING?.toLowerCase() === "true";

  if (fileLoggingEnabled) {
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

    transports.push(
      new DailyRotateFile({
        filename: path.join(process.cwd(), "logs", "http", "http-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        level: "http",
        zippedArchive: true,
        maxSize: "50m",
        maxFiles: "7d",
        format: fileFormat,
      }),
    );

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

  return transports;
}
