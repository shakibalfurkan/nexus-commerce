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

  resilience: {
    /** Base delay in ms for the first retry (doubles each attempt). */
    backoffBaseMs: Number(process.env.BACKOFF_BASE_MS) || 1_000,
    /** Maximum backoff delay cap in ms. */
    backoffMaxMs: Number(process.env.BACKOFF_MAX_MS) || 30_000,
    /** Max attempts including the first (`.clinerules` §6: max 3). */
    maxAttempts: Number(process.env.MAX_ATTEMPTS) || 3,
    /** Consecutive failures before opening the circuit breaker. */
    circuitBreakerFailureThreshold:
      Number(process.env.CB_FAILURE_THRESHOLD) || 5,
    /** How long the circuit stays open before transitioning to HALF_OPEN. */
    circuitBreakerResetTimeoutMs:
      Number(process.env.CB_RESET_TIMEOUT_MS) || 30_000,
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
