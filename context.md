# Nexus Commerce — Working Context

> Updated automatically at each step so work can resume after a break.
> Project rules: see `AGENTS.md`. Task: see `TODO.md`.

## Current Milestone / Step

**STEP 4 — Migrate services — DONE (all three services).**
**STEP 5 — Commits — IN PROGRESS (logical buildable chunks).**
Remaining: review `REVIEW-outbox-kafka.md` gaps all closed; verify final commit state.

Peer-review `REVIEW-outbox-kafka.md` (B1–B11) fully reconciled. A follow-up
consistency pass renamed the wire discriminator `eventName` → **`eventType`**
everywhere (producers, consumer schema, outbox store, DLQ helper, tests) so the
single canonical name matches the `OutboxEvent.eventType` DB column.

---

## STEP LOG

### STEP 1 — Audit — DONE (confirmed by user)
Findings in "Audit findings" below. Independently verified by peer review
(`REVIEW-outbox-kafka.md`): every audit claim confirmed; added corrections
B1–B11.

### STEP 2 — Build packages/kafka — DONE (+ compile break fixed)
Structure (one file per concern, `index.ts` barrel only): `types.ts`,
`backoff.ts`, `eventBus.ts` (TLS default-secure via `sslRejectUnauthorized`
default `true`; `saslMechanism` configurable; `createEventBus.publish` rethrows
so the poller's retry/DLQ path triggers), `outboxPoller.ts` (`OutboxPoller`
class, DI via `OutboxPollerDeps`; `handleNotification` wake-up w/ throttle;
`start()` 30s fallback + initial drain; `stop()` awaits in-flight batch),
`outboxListener.ts` (Postgres LISTEN/NOTIFY via `pg`; auto-reconnect w/
exponential backoff, `maxReconnectAttempts` default 10; `UNLISTEN` + close on
`stop()`), `deadLetter.ts` (`publishDeadLetterEvent({serviceName, eventId,
eventType, errorMessage, publish, logger})` → `KafkaTopics.DLQ`; `source` = passed
`serviceName`; best-effort). 10 unit tests, all passing.

### STEP 3 — Trigger migrations — DONE
`services/{auth,user}-service/prisma/migrations/20260814000000_add_outbox_notify_trigger/migration.sql`
— `CREATE OR REPLACE FUNCTION notify_outbox_event()` → `pg_notify('outbox_channel',
NEW.id::text)`; trigger `AFTER INSERT ON "outbox_events"` (physical table name
correct, B1). Down-migration documented as comment. Not applied to a live DB
(no Neon creds) — applies in deploy pipeline.

### STEP 4 — Migrate services — DONE
- **notification-service ✅**: imports `KafkaTopics` from `@nexus/event-contracts`.
- **auth-service ✅**: `events/outboxPoller.ts` constructs `OutboxPoller` +
  `OutboxListener`; deleted local `events/eventBus.ts`, `events/outboxDLQ.ts`,
  `events/handleProvisionedProfiles.ts`. `server.ts` calls `stopOutboxPoller()`.
- **user-service ✅** (this session): rewrote `events/outboxPoller.ts` to the
  shared wiring (re-exports `startOutboxPoller`/`stopOutboxPoller` so `server.ts`
  is unchanged); deleted orphaned `events/eventBus.ts` and `events/outboxDLQ.ts`
  (no importers — dead code); `outboxWriter.ts` dropped the 4 dead
  `COMMANDS`/`NOTIFICATIONS` topic mappings (non-existent topics) and routes
  everything to `DOMAIN_EVENTS`/`DLQ`; `config/kafka.ts` `console.warn` →
  `@nexus/logger` (B11).

### Consistency pass — `eventName` → `eventType` (this session)
Canonical event discriminator is now `eventType` everywhere:
- `packages/kafka/src/deadLetter.ts` — DLQ value uses `eventType` (+ tests).
- `notification-service` — `domain-event.schemas.ts` (field + `discriminatedUnion`
  key + registry mapped-type keys), `kafka-consumer.ts`, `notification-service.ts`.
- `auth-service` — `eventTypes.ts` (field + union key), `outboxWriter.ts`
  (`resolveTopic(eventType)`), emit sites in `auth.service.ts` + `customer.service.ts`.
- `user-service` — `eventTypes.ts` (field + union keys), `outboxWriter.ts`,
  `user.service.ts` emit site.
All four packages type-check clean on the outbox/rename path; `vitest` 10/10.

## Audit findings (Step 1 summary) — all resolved
- Headline bug (hardcoded `source: "user-service-outbox-poller"`) → fixed in
  shared `deadLetter.ts` (param now).
- Local `EventBus.publish` swallowed errors → shared `createEventBus.publish`
  rethrows.
- user-service `COMMANDS`/`NOTIFICATIONS` dead topics → deleted.
- Local `KafkaTopics` duplication → imported from `@nexus/event-contracts`.
- Wire envelope mismatch → intentionally NOT changing (B6).
- `console.warn` in configs → migrated to `@nexus/logger` (B11).

## Fixes applied (this session)
1. **`exactOptionalPropertyTypes` compile break** in `packages/kafka`
   (`eventBus.ts` + `outboxPoller.ts`) — conditionally spread `traceparent`.
2. **auth-server graceful shutdown** — `stopOutboxPoller()` in `shutdown`.
3. **user-service migration** to shared `@nexus/kafka` package (OutboxPoller +
   OutboxListener), delete dead local outbox files, fix dead topic maps.
4. **B11** — `console.warn` → `@nexus/logger` in user `config/kafka.ts`
   (auth already done by Cline).
5. **Consistency** — `eventName` → `eventType` across all producers/consumer/
   DLQ/tests.

## Git state / deps
- `packages/kafka/package.json`: deps += `pg`, `@nexus/event-contracts`;
  devDeps += `@types/pg`, `vitest`, `@vitest/coverage-v8`; `test` script.
  `pnpm-lock.yaml` updated.
- Uncommitted (mixed pre-existing WIP + Cline's + this session's):
  `packages/event-contracts` (`KafkaTopics` export), `packages/kafka`
  (`src/*` + `tests/`), notification + auth + user migrations, the two trigger-
  migration folders, `REVIEW-outbox-kafka.md`, `context.md`, `TODO.md`.
- STEP 5 commits in progress — each chunk leaves the repo building.

## Verification commands
- package: `cd packages/kafka && npx tsc --noEmit && npx vitest run`
- notification-service: `cd services/notification-service && npx tsc --noEmit`
- auth-service: `cd services/auth-service && npx tsc --noEmit`
- user-service: `cd services/user-service && npx tsc --noEmit` (outbox/rename
  path clean; ~50 PRE-EXISTING unrelated baseline errors remain in
  seller-profile / shop-address / audit-log / user.dto / auth.ts — out of scope,
  not regressed by this work).

## Remaining steps
- STEP 5: complete the commit sequence in logical chunks (each buildable):
  (1) shared package + tests, (2) trigger migrations, (3) notification migration,
  (4) auth migration, (5) user migration + consistency rename + B11. No unbuilt
  intermediate states.
