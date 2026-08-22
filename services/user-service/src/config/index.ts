import { loadEnv, requireEnv, optionalEnv } from "@nexus/config";

// Load and validate immediately — fail fast before any other module loads
loadEnv();

export default {
  node_env: optionalEnv("NODE_ENV", "development"),
  serviceName: optionalEnv("SERVICE_NAME", "user-service"),
  port: optionalEnv("PORT", "5001"),

  // ─── Redis ───
  redis: {
    url: process.env.REDIS_DATABASE_URL,
  },
  // ─── Kafka ───
  kafka: {
    broker: requireEnv("KAFKA_BROKER"),
    username: requireEnv("KAFKA_USERNAME"),
    password: requireEnv("KAFKA_PASSWORD"),
  },

  // ─── JWT ───
  jwt: {
    access_token_secret: requireEnv("JWT_ACCESS_TOKEN_SECRET"),
    refresh_token_secret: requireEnv("JWT_REFRESH_TOKEN_SECRET"),
  },

  // ─── Internal Service Auth ───
  internal_service_secret: requireEnv("INTERNAL_SERVICE_SECRET"),

  // ─── CORS ───
  allowed_origins:
    process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ??
    [],

  // ─── Client URLs ───
  user_client_url: optionalEnv("USER_CLIENT_URL", "http://localhost:3000"),
  seller_client_url: optionalEnv("SELLER_CLIENT_URL", "http://localhost:5173"),
  admin_client_url: optionalEnv("ADMIN_CLIENT_URL", "http://localhost:5174"),
} as const;
