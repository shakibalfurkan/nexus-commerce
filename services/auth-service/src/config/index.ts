import { loadEnv, requireEnv, optionalEnv } from "@nexus/config";

// Load and validate immediately — fail fast before any other module loads
loadEnv();

const config = {
  node_env: optionalEnv("NODE_ENV", "development"),
  serviceName: optionalEnv("SERVICE_NAME", "auth-service"),
  port: Number(process.env.PORT) || 5000,

  redis: {
    url: requireEnv("REDIS_DATABASE_URL"),
  },

  kafka: {
    broker: requireEnv("KAFKA_BROKER"),
    username: requireEnv("KAFKA_USERNAME"),
    password: requireEnv("KAFKA_PASSWORD"),
  },

  jwt: {
    access_token_secret: requireEnv("ACCESS_TOKEN_SECRET"),
    access_token_expires_in: optionalEnv("ACCESS_TOKEN_EXPIRES_IN", "15m"),
    refresh_token_secret: requireEnv("REFRESH_TOKEN_SECRET"),
    refresh_token_expires_in: optionalEnv("REFRESH_TOKEN_EXPIRES_IN", "7d"),

    password_reset_token_secret: requireEnv("PASSWORD_RESET_TOKEN_SECRET"),
    password_reset_token_expires_in: optionalEnv(
      "PASSWORD_RESET_TOKEN_EXPIRES_IN",
      "15m",
    ),
  },

  bcrypt_salt_round: Number(process.env.BCRYPT_SALT_ROUND) || 12,

  user_service_url: optionalEnv("USER_SERVICE_URL", "http://localhost:5001"),
  internal_service_secret: requireEnv("INTERNAL_SERVICE_SECRET"),

  customer_client_url: optionalEnv(
    "CUSTOMER_CLIENT_URL",
    "http://localhost:3000",
  ),
  seller_client_url: optionalEnv("SELLER_CLIENT_URL", "http://localhost:5173"),
  admin_client_url: optionalEnv("ADMIN_CLIENT_URL", "http://localhost:5174"),
} as const;

export default config;
