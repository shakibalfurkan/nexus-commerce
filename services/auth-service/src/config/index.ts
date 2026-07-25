import dotenv from "dotenv";
import path from "path";
import { AppError } from "../errors/AppError.js";

dotenv.config({ path: path.join(process.cwd(), ".env") });

function validateEnvVars(): void {
  const required = [
    "DATABASE_URL",
    "JWT_ACCESS_TOKEN_SECRET",
    "JWT_REFRESH_TOKEN_SECRET",
    "JWT_RESET_TOKEN_SECRET",
    "REDIS_DATABASE_URL",
    "INTERNAL_SERVICE_SECRET",
  ] as const;

  const missing = required.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === "",
  );

  if (missing.length > 0) {
    const msg = `❌ CRITICAL: Missing required environment variables: ${missing.join(", ")}`;
    throw new AppError(400, msg);
  }
}

// Run validation immediately — fail fast before any other module loads
validateEnvVars();

const config = {
  node_env: process.env.NODE_ENV ?? "development",
  serviceName: process.env.SERVICE_NAME ?? "auth-service",
  port: Number(process.env.PORT) || 5000,

  redis_database_url: process.env.REDIS_DATABASE_URL!,

  kafka: {
    broker: process.env.KAFKA_BROKER,
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },

  jwt: {
    access_token_secret: process.env.JWT_ACCESS_TOKEN_SECRET!,
    access_token_expires_in: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? "15m",
    refresh_token_secret: process.env.JWT_REFRESH_TOKEN_SECRET!,
    refresh_token_expires_in: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? "7d",
    reset_token_secret: process.env.JWT_RESET_TOKEN_SECRET!,
    reset_token_expires_in: process.env.JWT_RESET_TOKEN_EXPIRES_IN ?? "15m",
  },

  bcrypt_salt_round: Number(process.env.BCRYPT_SALT_ROUND) || 12,

  user_service_url: process.env.USER_SERVICE_URL ?? "http://localhost:5001",
  internal_service_secret: process.env.INTERNAL_SERVICE_SECRET!,

  allowed_origins:
    process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ??
    [],

  customer_client_url:
    process.env.CUSTOMER_CLIENT_URL ?? "http://localhost:3000",
  seller_client_url: process.env.SELLER_CLIENT_URL ?? "http://localhost:5173",
  admin_client_url: process.env.ADMIN_CLIENT_URL ?? "http://localhost:5174",
} as const;

export default config;
