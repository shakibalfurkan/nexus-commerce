import { loadEnv, optionalEnv } from "@nexus/config";

loadEnv();

export default {
  node_env: optionalEnv("NODE_ENV", "development"),
  isDevelopment: process.env.NODE_ENV === "development",
  serviceName: optionalEnv("SERVICE_NAME", "notification-service"),
  port: Number(process.env.PORT) || 5002,

  kafka: {
    broker: process.env.KAFKA_BROKER,
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },

  redis: {
    url: process.env.REDIS_DATABASE_URL,
  },

  rateLimit: {
    /** Max verification emails per recipient per window. */
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 5,
    /** Sliding window length in ms (default: 1 hour). */
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 3_600_000,
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: optionalEnv(
      "RESEND_FROM_EMAIL",
      "Nexus <no-reply@yourdomain.com>",
    ),
    timeoutMs: Number(process.env.RESEND_TIMEOUT_MS) || 10_000,
  },
} as const;
