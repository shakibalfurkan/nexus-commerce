import winston from "winston";
import { buildTransports } from "./transports.js";
import { redactionFormat } from "./redaction.js";
import { fileFormat } from "./format.js";
import type { Logger, LoggerConfig, MorganStream } from "./types.js";

/**
 * Create a production-hardened Winston logger.
 *
 * - Console transport is always present (primary transport; stdout in prod).
 * - File transports are opt-in via `ENABLE_FILE_LOGGING=true` (default OFF) —
 *   see {@link buildTransports} for the ephemeral-filesystem rationale.
 * - Redaction runs as a format BEFORE any transport, so secrets/PII are
 *   scrubbed for every transport, not per call site.
 * - `defaultMeta` injects `service` + `env` so every line is attributable.
 *
 * Signature is unchanged from the original single-file package: no service
 * call sites require edits.
 */
export function createLogger(config: LoggerConfig): Logger {
  const isDevelopment =
    config.isDevelopment ?? config.node_env === "development";

  const transports = buildTransports(config);

  const logger = winston.createLogger({
    level: isDevelopment ? "debug" : "info",
    defaultMeta: {
      service: config.serviceName,
      env: config.node_env,
    },
    format: winston.format.combine(redactionFormat(), fileFormat),
    transports,
    exitOnError: false,
  });

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

  return logger as Logger;
}

/**
 * Morgan stream adapter that routes HTTP request logs through the shared
 * logger at the `http` level. Signature unchanged.
 */
export function createMorganStream(logger: Logger): MorganStream {
  return {
    write: (message: string) => logger.http(message.trim()),
  };
}
