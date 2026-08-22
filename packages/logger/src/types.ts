import type winston from "winston";

/**
 * Configuration accepted by {@link createLogger}.
 * `isDevelopment` is optional; when omitted it defaults to
 * `node_env === "development"`.
 */
export interface LoggerConfig {
  serviceName: string;
  node_env: string;
  isDevelopment?: boolean;
}

/**
 * Narrowed logger surface exposed to services. Mirrors the Winston logger
 * methods services actually call. Intentionally unchanged so no service
 * call sites require edits during the package restructure.
 */
export interface Logger {
  debug: winston.Logger["debug"];
  info: winston.Logger["info"];
  warn: winston.Logger["warn"];
  error: winston.Logger["error"];
  http: winston.Logger["http"];
  /** Bind persistent metadata (e.g. request context) returning a child logger. */
  child: winston.Logger["child"];
}

/**
 * Stream adapter consumed by `morgan` for HTTP request logging.
 */
export interface MorganStream {
  write: (message: string) => void;
}
