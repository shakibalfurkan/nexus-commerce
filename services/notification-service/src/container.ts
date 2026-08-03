import { ResendEmailProvider } from "./providers/resend-email.provider.js";
import { EmailProviderError } from "./providers/email-provider.error.js";
import { createCircuitBreaker } from "./resilience/circuit-breaker.js";
import { createRateLimiter } from "./ratelimit/rate-limiter.js";
import { createBackoffOptions } from "./resilience/backoff.js";
import { NotificationService } from "./services/notification-service.js";
import { startKafkaConsumer } from "./events/kafka-consumer.js";
import config from "./config/index.js";

/**
 * Composition Root — Wires all dependencies together using Dependency
 * Injection. This is the only place where concrete implementations are
 * instantiated and connected (`.clinerules` §4: clean layering).
 *
 * The NotificationService receives its dependencies as interfaces and
 * never knows about Resend, Prisma, or Kafka directly.
 */

/** Only retryable email errors (5xx, 429, network) trip the breaker. */
function isRetryableEmailError(error: unknown): boolean {
  return error instanceof EmailProviderError && error.retryable;
}

/**
 * Create the NotificationService with all dependencies wired from config.
 * @throws if RESEND_API_KEY is not configured.
 */
export function createNotificationService(): NotificationService {
  const apiKey = config.resend.apiKey;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is required — cannot start notification service",
    );
  }

  const emailProvider = new ResendEmailProvider({
    apiKey,
    fromEmail: config.resend.fromEmail,
    timeoutMs: config.resend.timeoutMs,
  });

  const circuitBreaker = createCircuitBreaker(isRetryableEmailError);
  const rateLimiter = createRateLimiter();
  const backoffOptions = createBackoffOptions();

  return new NotificationService({
    emailProvider,
    rateLimiter,
    circuitBreaker,
    backoffOptions,
  });
}

/**
 * Start the full notification pipeline: create the service and start the
 * Kafka consumer. Called from server.ts on startup.
 *
 * Errors propagate to the caller (server.ts), which fails fast with a
 * non-zero exit — a broken Kafka/Resend config must not silently leave the
 * service running with notifications disabled.
 */
export async function startNotificationPipeline(): Promise<void> {
  const service = createNotificationService();
  await startKafkaConsumer(service);
}
