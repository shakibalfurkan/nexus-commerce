# Nexus — Project Rules

Formerly ClassyShop — never use old name in code/docs/commits.

## Stack & Shape

3 frontends: Next.js customer storefront (SSR-first, SEO/perf-critical), React
seller + admin dashboards (client-heavy). Backend: Node/TS microservices — auth,
user, notification, gateway, shop (+more). Turborepo: `apps/`, `services/`,
`packages/`, `infrastructure/`, `docs/adr/`. Free-tier only, no card on file:
Neon/Aiven Postgres, Aiven Kafka (5-topic cap), Upstash Redis (shared), Resend,
Render.

## Architecture (non-negotiable)

- No cross-service DB reads — API calls or Kafka events only.
- **user-service** = source of truth for user state; auth-service holds a
  read-only replica via Kafka outbox.
- Domain logic never imports Express/Prisma/Kafka/vendor SDKs directly — adapter
  layer + interface only.
- Shared packages only when 2+ services actually consume them — justify in one
  line.

## Security

Zod validation at every external boundary (HTTP + Kafka payloads). Bcrypt
passwords, never logged/stored plaintext. Short-lived JWT + refresh rotation.
Redis sliding-window rate limits on public auth/notification endpoints. Helmet +
CORS locked to known origins in prod. Escape all HTML/template interpolation.
Secrets only in env vars, never logs/commits/bundles. Every protected endpoint:
authenticated → authorized → ownership-checked (no IDOR). Destructive ops
(force-push, reset --hard, DROP/TRUNCATE, prod mutation, Redis flush) — explicit
approval + rollback plan, every time.

## Kafka

At-least-once — all consumers idempotent (dedup table/key). Envelope:

```
{ eventId, eventType: "domain.aggregate.event.v1", eventVersion, occurredAt (UTC ISO),
  producer, correlationId, causationId, traceparent, payload }
```

Backoff + jitter, max 3 retries, circuit breaker on external HTTP, DLQ after
exhaustion. DB write + event publish → transactional outbox, always. Redis keys:
`<service>:<purpose>:<id>`, never generic, always TTL. 5-topic ceiling (Aiven
free tier) — flag quota impact before adding one.

Outbox delivery: interval poller, 5s, uniform across all services regardless of
DB provider (CockroachDB does not support Postgres LISTEN/NOTIFY, so polling is
used consistently rather than a mixed strategy). Shared engine in
`packages/kafka`, never duplicated per-service.

## Frontend

Skeleton loading matching real content shape — never a generic spinner (spinners
only for button-submit states). Storefront: SSR/server components by default,
strong CWV, WCAG 2.2 AA. Dashboards: typed API client + React Query (no fetch in
JSX), seller isolation enforced server-side. shadcn/ui lives only in
`packages/ui`, never per-app. Motion is default everywhere; GSAP + ScrollTrigger
reserved for storefront marketing/hero moments only.

## Code Quality

TS strict, no bare `any`. No `console.log` in prod — shared logger. No empty
catches. Structured logs with `requestId`/`correlationId`/`traceId` — never log
secrets/PII.
File naming: camelCase for all source files under `apps/`, `services/`,
`packages/` — never kebab-case or dot-separated words
(e.g. `resendEmailProvider.ts`, `emailProviderInterface.ts`,
`kafkaMessageTypes.ts`). Suffix roles MAY stay as a single dot-suffix
(`.interface`, `.error`, `.types`, `.config`) to mark kind, but the base name
is camelCase. Exception: React components stay PascalCase `.tsx`; config
`.json` and framework barrels are out of scope. No filename-lint plugin is
configured in the toolchain, so this is a documented manual convention —
enforce on review.

## Money (placeholder — expand when payment-service exists)

Integer minor units, explicit currency code, immutable ledger, idempotent
mutations, verified webhook signatures, never store raw card data.

## Hard Forbidden

Cross-service DB access · secrets outside env vars · wildcard CORS in prod ·
disabled auth/rate-limits · infinite retries · non-idempotent financial/Kafka
mutations · missing DLQ · unescaped HTML · destructive DB/git ops without
approval · unjustified new dependencies. automatic redrive of DEAD events for payment/order domains (manual admin
review required — automatic redrive is fine for low-stakes domains only)

## Workflow

One milestone at a time unless told otherwise. Conventional Commits,
service-scoped (e.g. `feat(notification): add resend adapter`). ADR in
`docs/adr/` for boundary, data-ownership, or vendor decisions. Never add
"Co-Authored-By: Claude" or any AI-attribution trailer to commit messages —
this repo is a job-search portfolio; commit authorship must reflect the
human author only.
