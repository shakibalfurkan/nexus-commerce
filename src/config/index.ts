import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

// ─── Staff-Level Config Validation ───
// All environment variables are validated at startup.
// If a required variable is missing, the process fails immediately with
// a clear error message — not 3 hours later under load.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[CONFIG] Missing required environment variable: ${name}. ` +
        `The service cannot start without this value.`,
    );
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export default {
  node_env: optionalEnv("NODE_ENV", "development"),
  serviceName: optionalEnv("SERVICE_NAME", "user-service"),
  port: optionalEnv("PORT", "5001"),

  // ─── Database ───
  database_url: requireEnv("DATABASE_URL"),

  // ─── Redis ───
  redis_database_url: requireEnv("REDIS_DATABASE_URL"),

  // ─── Kafka ───
  kafka: {
    broker: requireEnv("KAFKA_BROKER"),
    username: optionalEnv("KAFKA_USERNAME", ""),
    password: optionalEnv("KAFKA_PASSWORD", ""),
  },

  // ─── JWT ───
  jwt: {
    access_token_secret: requireEnv("JWT_ACCESS_TOKEN_SECRET"),
    refresh_token_secret: requireEnv("JWT_REFRESH_TOKEN_SECRET"),
  },

  // ─── Internal Service Auth ───
  internal_service_secret: requireEnv("INTERNAL_SERVICE_SECRET"),

  // ─── PII Encryption (Sprint 2) ───
  // ENCRYPTION_MASTER_KEY: 64-char hex string (32 bytes) for AES-256-GCM
  // Generate with: openssl rand -hex 32
  encryption: {
    master_key: requireEnv("ENCRYPTION_MASTER_KEY"),
    blind_index_secret: requireEnv("BLIND_INDEX_SECRET"),
  },

  // ─── CORS ───
  allowed_origins:
    process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ??
    [],

  // ─── Client URLs ───
  user_client_url: optionalEnv("USER_CLIENT_URL", "http://localhost:3000"),
  seller_client_url: optionalEnv("SELLER_CLIENT_URL", "http://localhost:5173"),
  admin_client_url: optionalEnv("ADMIN_CLIENT_URL", "http://localhost:5174"),
} as const;
