import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const config = {
  node_env: process.env.NODE_ENV || "development",
  serviceName: process.env.SERVICE_NAME || "api-gateway",
  port: Number(process.env.PORT) || 8080,

  redis_database_url: process.env.REDIS_DATABASE_URL || "",

  proxy_timeout: Number(process.env.PROXY_TIMEOUT) || 30000,

  circuit_breaker_threshold: Number(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
  circuit_breaker_timeout: Number(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000,
  circuit_breaker_reset_timeout:
    Number(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT) || 30000,

  rate_limit_window_ms: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  rate_limit_max: Number(process.env.RATE_LIMIT_MAX) || 200,

  auth_service_url: process.env.AUTH_SERVICE_URL || "",
  user_service_url: process.env.USER_SERVICE_URL || "",

  allowed_origins:
    process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ??
    [],

  cors_max_age: Number(process.env.CORS_MAX_AGE) || 86400,
} as const;

export default config;
