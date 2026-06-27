import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  env: process.env.ENV,
  serviceName: process.env.SERVICE_NAME,
  port: process.env.PORT,

  redis_database_url: process.env.REDIS_DATABASE_URL,

  circuit_breaker_threshold: Number(process.env.CIRCUIT_BREAKER_THRESHOLD),
  circuit_breaker_timeout: Number(process.env.CIRCUIT_BREAKER_TIMEOUT),
  circuit_breaker_reset_timeout: Number(
    process.env.CIRCUIT_BREAKER_RESET_TIMEOUT,
  ),

  proxy_timeout: Number(process.env.PROXY_TIMEOUT),

  auth_service_url: process.env.AUTH_SERVICE_URL,
  user_service_url: process.env.USER_SERVICE_URL,
  payment_service_url: process.env.PAYMENT_SERVICE_URL,

  allowed_origins:
    process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ??
    [],
} as const;
