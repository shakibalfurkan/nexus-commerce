# Nexus Notification Service — Build Context

## Project

Event-driven Notification Service consuming Kafka `domain-events` and sending
transactional emails (verification, welcome, password reset). Built for a $200k+
senior engineering showcase. Monorepo: Turborepo + pnpm.

## Stack

- Node.js / TypeScript (strict, `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`)
- Kafka (Aiven free tier, at-least-once delivery)
- PostgreSQL (Neon/Aiven via Prisma 7, `prisma-client` generator →
  `src/generated/prisma`)
- Redis (Upstash shared instance, strict `notification:*` namespacing)
- **Resend HTTP API** (raw `fetch`, no SDK)
- **React Email v6** (components + `render()` from `react-email` package — NOT
  `@react-email/components`, which is deprecated)
- Structured JSON logging via `@nexus/logger`

## Key Decisions

1. **React Email over EJS/Handlebars** (user override): JSX auto-escapes → HTML
   injection prevention for free; typed props → compile-time template variable
   safety. Removed `ejs`, `handlebars`, `nodemailer` deps.
2. **Resend via raw HTTP** (`POST https://api.resend.com/emails`, Bearer auth)
   behind `EmailProvider` interface — no SDK leak into core logic.
3. **Prisma output path** aligned to `src/generated/prisma` (matches
   auth-service). `.gitignore` updated to `/src/generated/prisma`.
4. **Idempotency**: `NotificationLog.eventId @unique` (Kafka `aggregateId`).
   Duplicate insert → unique violation → treated as already-processed.
5. **Error classification**: `EmailProviderError` with `retryable` flag — 4xx
   (except 429) non-retryable, 429/5xx/network retryable.
6. **pnpm version**: project pins `pnpm@10.25.0`; system had v9 — resolved via
   `corepack enable && corepack prepare pnpm@10.25.0 --activate`.
7. **Rate limiter**: atomic Lua script via Redis `EVAL` — sliding window ZSET
   with `ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` in a single atomic operation.
   Recipient emails SHA-256 hashed in keys to avoid PII in Redis.

## Milestone 1 — DONE (committed `1f5e307`)

- `prisma/schema.prisma`: `NotificationLog` (idempotency + resilience fields:
  `providerMessageId`, `lastAttemptAt`, `nextRetryAt`, `causationId`, trace
  fields) + `DeadLetterEntry` + enums. Indexes on `(status, createdAt)`,
  `(status, nextRetryAt)`, `(recipient, createdAt)`, `(eventType)`,
  `(notificationType)`.
- `src/lib/prisma.ts`: PrismaPg adapter, pool config, slow-query logging,
  `disconnectPrisma()`.
- Event schemas (`src/events/domain-event.schemas.ts`) + Kafka message types
  (`src/types/kafka-message.types.ts`) already existed from prior commit
  `604ab1c` — registry/map pattern, Zod discriminated union, traceparent from
  headers.

## Milestone 2 — DONE (committed `841413e`)

- `src/providers/email-provider.interface.ts`: `EmailProvider`,
  `SendEmailCommand`, `SendEmailResult`.
- `src/providers/email-provider.error.ts`: `EmailProviderError` with
  `retryable`/`statusCode`/`providerCode`.
- `src/providers/resend-email.provider.ts`: `ResendEmailProvider` (raw fetch,
  timeout via AbortController, error classification).
- React Email templates (`.tsx`): `EmailLayout` shell +
  `EmailVerificationEmail`, `WelcomeEmail`, `PasswordResetEmail` — typed props,
  import from `react-email`.
- `src/templates/template-engine.ts`: registry/map pattern mapping `templateKey`
  → React component; `render()` from `@react-email/render`.
- Config: `resend` block (apiKey, fromEmail, timeoutMs); SMTP removed.
- Legacy files deleted: `.ejs` templates, `sendMail.ts`, `event-bus.ts`,
  `kafka-consumer.ts`, `event-types.ts`, placeholder handlers.
- Deps: `+ react`, `react-email`, `@react-email/render`; `- ejs`, `handlebars`,
  `nodemailer`.

## Milestone 3 — DONE (committed `47dd827`)

- `src/lib/redis.ts`: Redis client singleton via `@nexus/redis`
  (`createRedisClient`), `disconnectRedis()` for graceful shutdown.
- `src/ratelimit/rate-limiter.ts`: `SlidingWindowRateLimiter` — atomic Lua
  script via `EVAL` (ZSET sliding window: `ZREMRANGEBYSCORE` → `ZCARD` →
  `ZADD` + `PEXPIRE`). Returns `{ allowed, remaining, limit, retryAfterMs }`.
  `checkOrThrow()` convenience throws `TooManyRequestsError`. Keys:
  `notification:ratelimit:email:{notificationType}:{sha256(recipient)}` — no PII
  in Redis. `createRateLimiter()` factory returns `null` if Redis unavailable
  (fail-open decision deferred to M5).
- `src/idempotency/idempotency.ts`: `claimNotification()` — inserts PENDING
  `NotificationLog` row with `eventId` = Kafka `aggregateId`. Prisma P2002
  (unique constraint) caught → `{ status: "duplicate" }`. Non-duplicate errors
  re-thrown for M5 retry/DLQ routing. `isUniqueConstraintViolation()` uses
  `instanceof Prisma.PrismaClientKnownRequestError` + duck-type fallback.
- Config: `redis` block (url from `REDIS_DATABASE_URL`), `rateLimit` block
  (maxRequests=5, windowMs=3600000). `.env.example` updated with
  `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`.
- Deps: `+ @nexus/redis` (workspace). Typecheck: `tsc --noEmit` exit 0.

## Milestone 4 — DONE (committed `6910cfb`)

- `src/resilience/backoff.ts`: `calculateBackoff()` (full jitter — random
  between 0 and min(base \* 2^attempt, max)), `sleep()`, `retryWithBackoff()`
  wrapper (max 3 attempts, only retries when `shouldRetry` returns true,
  non-retryable errors thrown immediately). `createBackoffOptions()` factory
  from config.
- `src/resilience/circuit-breaker.ts`: `CircuitBreaker` class —
  CLOSED/OPEN/HALF_OPEN state machine. `execute<T>()` wraps async operations;
  OPEN state fast-fails with `CircuitBreakerError`. `shouldTrip` predicate
  determines which errors count as failures (for email provider: only
  `EmailProviderError` with `retryable: true`). `createCircuitBreaker()` factory
  from config.
- Config: `resilience` block (backoffBaseMs=1000, backoffMaxMs=30000,
  maxAttempts=3, circuitBreakerFailureThreshold=5,
  circuitBreakerResetTimeoutMs=30000). `.env.example` updated with
  `BACKOFF_BASE_MS`, `BACKOFF_MAX_MS`, `MAX_ATTEMPTS`, `CB_FAILURE_THRESHOLD`,
  `CB_RESET_TIMEOUT_MS`.
- Typecheck: `tsc --noEmit` exit 0.

## Milestone 5 — DONE (committed `c986937`)

- `src/services/notification-service.ts`: `NotificationService` class — clean
  architecture domain layer with DI. `processEvent()` orchestrates: registry
  lookup → idempotency claim → rate limit check → template render → email send
  (circuit breaker + retryWithBackoff) → markAsSent/markAsFailed → DLQ routing.
  Errors before log creation throw (KafkaJS redelivers); errors after log
  creation are caught and return `{ status: "failed" }` (log tracks retry).
- `src/services/notification-log.ts`: `markAsSent()`, `markAsFailed()` —
  infrastructure adapters using Prisma. `markAsFailed` increments attemptCount
  and returns updated values for DLQ check.
- `src/services/dlq.ts`: `routeToDlq()` — updates NotificationLog to DLQ,
  creates DeadLetterEntry, publishes to Kafka DLQ topic. Never silently drops
  (`.clinerules` §6).
- `src/events/kafka-consumer.ts`: Kafka consumer using `kafka.consumer()` from
  `@nexus/kafka`. Parses messages with `parseKafkaMessage` (headers for
  traceparent/correlationId). Re-throws pre-log errors for KafkaJS redelivery.
- `src/container.ts`: Composition root — wires ResendEmailProvider,
  CircuitBreaker (shouldTrip = isRetryableEmailError), RateLimiter,
  BackoffOptions into NotificationService. `startNotificationPipeline()` creates
  service + starts consumer.
- `src/server.ts`: Updated to call `startNotificationPipeline()` on startup.
- `src/events/domain-event.schemas.ts`: Added `getSubject` to
  `domainEventRegistry` (per-event-type email subject line).
- Typecheck: `tsc --noEmit` exit 0. `as never` casts used for TypeScript
  correlated-union limitation (TS#30581).

## Milestone 6 — DONE (committed pending)

- `docs/system-design-cheatsheet.md`: Comprehensive system design interview
  cheat sheet covering:
  - Why "exactly-once delivery" is impossible (Two Generals Problem, FLP
    Impossibility, crash window, Kafka's actual guarantees)
  - How this architecture handles failures (at-least-once + idempotency, error
    classification, exponential backoff + full jitter, circuit breaker, DLQ,
    rate limiting, before/after log error strategy)
  - Architecture diagram (text-based)
  - Key trade-offs table
  - 5 failure scenarios with step-by-step handling
  - Observability (structured logging, traceparent propagation, NotificationLog
    audit trail)
  - 6 interview talking points with model answers

## All Milestones Complete ✅

## Gotchas

- `exactOptionalPropertyTypes: true` → optional props need `?: T | undefined`,
  and never pass `undefined` explicitly to an optional prop. Use conditional
  spread: `...(value !== undefined ? { key: value } : {})`.
- `@react-email/components` is deprecated — import everything from `react-email`
  directly.
- Prisma client regenerates on `postinstall`; output path is
  `src/generated/prisma` (gitignored).
- No local Docker — everything env-var driven for cloud
  (Neon/Aiven/Upstash/Resend).
- ioredis `eval` returns `unknown` — cast to `unknown[]` and use `Number()` for
  Lua return values (may arrive as strings or numbers depending on ioredis
  version).
- `noUncheckedIndexedAccess: true` → array access returns `T | undefined`; use
  `??` fallback.
