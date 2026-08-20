import winston from "winston";

/**
 * Human-readable, colorized console format used in development. Mirrors the
 * original single-file `consoleFormat` definition.
 */
export const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : "";
    return `${timestamp} ${level}: ${message}${metaStr}`;
  }),
);

/**
 * Structured JSON format used in production (and for file transports). Mirrors
 * the original single-file `fileFormat` definition; expands Error stacks.
 */
export const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);
