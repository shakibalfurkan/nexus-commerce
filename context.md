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

## Milestone 2 — IN PROGRESS (Provider Abstraction & Template Engine)

### Done

- `src/providers/email-provider.interface.ts`: `EmailProvider`,
  `SendEmailCommand`, `SendEmailResult`.
- `src/providers/email-provider.error.ts`: `EmailProviderError` with
  `retryable`/`statusCode`/`providerCode`.
- `src/providers/resend-email.provider.ts`: `ResendEmailProvider` (raw fetch,
  timeout via AbortController, error classification). **NOTE: file was emptied
  by a failed replace_in_file — needs rewrite.**
- Deps installed: `react`, `react-email`, `@react-email/render`, `@types/react`,
  `@types/react-dom`. Removed: `ejs`, `handlebars`, `nodemailer`, their
  `@types`.

### Remaining

1. **Rewrite `resend-email.provider.ts`** (was emptied). Fix `providerCode`
   optional-prop issue: build options object conditionally (don't pass
   `undefined` with `exactOptionalPropertyTypes`).
2. **React Email templates** in `src/templates/` (`.tsx`):
   `EmailVerificationEmail`, `WelcomeEmail`, `PasswordResetEmail` — typed props,
   import from `react-email` (Html, Body, Container, Heading, Text, Button, Hr,
   Section, Preview, Img, Link).
3. **Template engine** (`src/templates/template-engine.ts`): registry/map
   pattern mapping `templateKey` → React component; `render()` from
   `@react-email/render` to HTML string.
4. **Update `src/config/index.ts`**: add `resend` config (apiKey, fromEmail,
   timeoutMs); remove SMTP config.
5. **Update `.env.example`**: already has `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   — remove SMTP vars.
6. **Delete legacy files**: `src/utils/sendMail.ts` (nodemailer), old `.ejs`
   templates, `src/handlers/*` (will be replaced in M5),
   `src/events/event-bus.ts`/`kafka-consumer.ts`/`event-types.ts` (legacy,
   replaced in M5).
7. **Verify typecheck** (`npx tsc --noEmit` → exit 0).
8. **Commit** with Conventional Commits message.
9. **Stop and ask approval** for Milestone 3.

## Milestones Ahead

- **M3**: Redis namespaced rate limiter (`notification:ratelimit:*`) +
  idempotency layer.
- **M4**: Resilience engine (exponential backoff + jitter, circuit breaker).
- **M5**: Core Kafka consumer + clean architecture service layer (DI, DLQ
  fallback).
- **M6**: System design interview cheat sheet.

## Gotchas

- `exactOptionalPropertyTypes: true` → optional props need `?: T | undefined`,
  and never pass `undefined` explicitly to an optional prop.
- `@react-email/components` is deprecated — import everything from `react-email`
  directly.
- Prisma client regenerates on `postinstall`; output path is
  `src/generated/prisma` (gitignored).
- No local Docker — everything env-var driven for cloud
  (Neon/Aiven/Upstash/Resend).
