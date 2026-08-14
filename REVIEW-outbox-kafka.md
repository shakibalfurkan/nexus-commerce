# Peer Review — Outbox → `packages/kafka` Refactor (Steps 1–5)

Reviewer: parallel review agent. Scope: validate the STEP 1 audit against the
actual code, and pressure-test the planned STEP 2–5 design for runtime
correctness and production-readiness. Every claim below is grounded in a file
read on the current working tree (HEAD `80c0d01` + uncommitted WIP).

---

## A. Audit claims — VERIFIED TRUE (confirmed in code)

| # | Claim | Evidence |
|---|-------|----------|
| 1 | **Hardcoded wrong `source` in DLQ payload (both services).** | `services/auth-service/src/events/outboxPoller.ts:169-178` and `services/user-service/src/events/outboxPoller.ts:169-178` both set `metadata.source: "user-service-outbox-poller"`. So **auth-service publishes DLQ events labeled `user-service`**. Headline bug — fix by passing `serviceName`. |
| 2 | Local `KafkaTopics` duplicated; `console.warn` violates no-console rule. | `services/auth-service/src/config/kafka.ts:25` and `services/user-service/src/config/kafka.ts:25` use `console.warn`. |
| 3 | user-service references non-existent `KafkaTopics.COMMANDS` / `.NOTIFICATIONS`. | `services/user-service/src/events/outboxWriter.ts:33-34` (`generate.pdf_invoice` → `KafkaTopics.COMMANDS`, `email.send_welcome` → `KafkaTopics.NOTIFICATIONS`). Neither exists in local or `@nexus/event-contracts` `KafkaTopics` (only `DOMAIN_EVENTS`, `DLQ`). Dead/broken config. |
| 5 | Local `EventBus.publish` **swallows errors** (no rethrow) → false completion. | `services/auth-service/src/events/eventBus.ts:30-32` catches and does NOT rethrow; poller marks row `COMPLETED` after `await EventBus.publish`. Shared `createEventBus.publish` (`packages/kafka/src/index.ts`) DOES rethrow — good. Migration must preserve rethrow. |
| 7 | `maxRetries` declared in poller options AND hardcoded `5` in `writeOutboxEvent`, but poller never reads the DB column. | `outboxPoller.ts` uses `effectiveOptions.maxRetries`; `outboxWriter.ts:49/233` writes `maxRetries: 5` to DB, never read. Redundant. |
| 8 | Wire envelope mismatch: producers write `{eventName, aggregateId, payload, metadata:{emittedAt,source,version}}`; `event-contracts` `EventEnvelope` is `{eventId, eventType, eventVersion, occurredAt, producer, correlationId, causationId, traceparent, payload}`. | `services/auth-service/src/events/eventTypes.ts` (producer shape) vs `packages/event-contracts/src/index.ts:10-20` (envelope). Entirely different shapes. |
| 9 | DLQ payload shapes inconsistent across outbox vs notification. | outbox: `{eventName, aggregateId, payload:{originalEventId,...}, metadata:{source}}` (`outboxPoller.ts:169-178`); notification `routeToDlq`: `{eventId, eventType, failureReason, attemptCount, recipient}` + `deadLetterEntry` table (`services/notification-service/src/services/dlq.ts`). |
| 10 | `resolveTopic` duplicated per service (auth 6-map, user 16-map). | `outboxWriter.ts` in both. Stays per-service; shared poller must take it as a callback. |
| — | auth `server.ts` starts poller but never calls `stopOutboxPoller()` on shutdown; user-service does. | `services/auth-service/src/server.ts:31` (no stop) vs `services/user-service/src/server.ts:81` (stop). |

Also confirmed good/consistent (audit correct):
- `OutboxPollerOptions` shape identical across auth & user.
- Prisma `OutboxEvent` model byte-identical; `@@map("outbox_events")`, index `idx_outbox_polling(status, lockedAt, createdAt)`. (`services/*/prisma/schema.prisma:99-120` / `224-245`.)
- notification-service already migrated `KafkaTopics` to `@nexus/event-contracts` (`dlq.ts:3`).
- `packages/kafka` `buildDeadLetterEvent` already passes `source` as a **parameter** (correct) — so the per-service `publishDeadLetterEvent` should be *replaced* by a shared helper built on it.

---

## B. Gaps the audit MISSED (loopholes in the PLANNED approach)

### B1. 🔴 Migration template targets the WRONG table name — it will fail.
The TODO STEP 3 template says:
```sql
CREATE TRIGGER outbox_event_notify AFTER INSERT ON "OutboxEvent" ...
```
But the Prisma model is `@@map("outbox_events")` — the **physical table is `outbox_events`**, not `OutboxEvent`. Postgres triggers resolve against the *table*, not the model. This migration would fail on apply (relation `"OutboxEvent"` does not exist). **Use `ON "outbox_events"`** in both auth and user migrations. (Verified: `CREATE TABLE "outbox_events"` in existing migrations `20260709160735_.../migration.sql:23` and `20260704141843_.../migration.sql:63`.)

### B2. 🔴 `pg` is not a dependency of `packages/kafka`.
STEP 2 `outboxListener.ts` uses a raw `pg` Client. `packages/kafka/package.json` deps are only `kafkajs`, `uuid`, `@nexus/logger`. **Add `pg` + `@types/pg` to `packages/kafka/package.json`** or the listener won't compile/run.

### B3. 🟠 No test framework exists anywhere.
`context.md` says "No test files exist anywhere." Root `package.json` has no `vitest`/`jest`, no test script. STEP 2 asks for `backoff.ts` to be "unit-testable, pure function" — true in principle, but there is **no runner to execute tests**, and STEP 5 says "verify existing tests pass" when none exist. For production-grade: add `vitest` to `packages/kafka` and ship unit tests for `calculateBackoff`, `buildDeadLetterEvent`/`publishDeadLetterEvent` shape, and `resolveTopic`. At minimum, state plainly in the commit that verification = `tsc --noEmit` only.

### B4. 🟠 OutboxListener must treat NOTIFY as a "wake-up", NOT per-row delivery.
Postgres `LISTEN/NOTIFY` is fire-and-forget and **coalesces** notifications with identical payloads within a transaction; messages sent while disconnected are **dropped**. Therefore the listener handler should **ignore the payload and call the SAME `processNextBatch()` as the interval poll** — the poll reads all eligible rows, and the existing `PROCESSING`+`lockTimeout` lock **dedupes** between listener-triggered and interval-triggered runs. Do NOT have the listener fetch-and-process a single `id` from the payload; that path loses events on coalesce/drop. Also add a short **throttle** on the notify→poll trigger so a burst of 1k NOTIFYs doesn't spawn 1k batch polls.

### B5. 🟠 Don't silently change consumer error semantics when consolidating EventBus.
The shared `createEventBus.subscribe` (and `publish`) **rethrow**; the *local* `EventBus.subscribe` **swallows** errors (`eventBus.ts:62-64`). `handleProvisionedProfiles` (auth) uses the local subscribe, so handler failures are currently swallowed → message auto-committed → **lost**. Migrating the outbox *producer* path to the shared `createEventBus.publish` (rethrow) is correct and required (fixes B of #5). But be deliberate about the *consumer* (`handleProvisionedProfiles`): either keep it on the local EventBus, or migrate it to shared `subscribe` (rethrow = correct redelivery, an improvement). Don't let the change happen by accident.

### B6. 🟠 Shared `OutboxEvent` type must model the REAL producer shape, never `event-contracts.EventEnvelope`.
Per #8 the two shapes differ completely. The shared poller's `types.ts` should define an `OutboxEventRow` matching the DB columns + the real `{eventName, aggregateId, payload, metadata}` payload — NOT import `EventEnvelope`. **Do NOT "fix" producers to emit `EventEnvelope`** (that would break notification consumers and is out of scope). Envelope reconciliation is a separate effort; keep it out of this refactor.

### B7. 🟠 user-service `outboxWriter` `resolveTopic` map references non-existent topics.
After STEP 4 imports `KafkaTopics` from `@nexus/event-contracts`, the entries `KafkaTopics.COMMANDS` / `KafkaTopics.NOTIFICATIONS` become `undefined` at runtime (`event-contracts` only has `DOMAIN_EVENTS`, `DLQ` — `event-contracts/src/index.ts:3-6`). Those 4 events (`generate.pdf_invoice`, `sync.user_to_crm`, `email.send_welcome`, `email.send_otp`) have **no schema in event-contracts either** → dead config. **Delete those 4 mappings** (they never fire correctly today) rather than leaving `resolveTopic` returning `undefined`.

### B8. 🟠 `maxRetries` redundancy — decide and document.
Poller decides DEAD using `effectiveOptions.maxRetries` (options), never the DB `maxRetries` column. Either honor the DB column per-row, or (simpler) keep options-only and document the column as metadata. Don't leave two sources of truth silently.

### B9. 🟠 `createKafkaClient` disables TLS verification + hardcodes SASL mechanism.
`packages/kafka/src/index.ts:48` sets `ssl: { rejectUnauthorized: false }` (MITM-exposed) and hardcodes `mechanism: "scram-sha-256"` (line 53). AGENTS.md forbids security weakeners. As part of the "review + fix EventBus" commit, **make TLS verification default-secure** (`rejectUnauthorized: true` unless an explicit override env is set) and make the SASL mechanism configurable. Flag this in the audit's "review existing EventBus" step.

### B10. 🟠 Shutdown is not graceful.
- `stopOutboxPoller` (`outboxPoller.ts:214-223`) clears the interval but does **not await an in-flight batch**. A `SIGTERM` can kill mid-publish and leave a row `PROCESSING` (reclaimed after `lockTimeoutMs`, so not fatal, but not clean).
- `outboxListener` (new) MUST, on `stop()`: `UNLISTEN`, `client.end()`, and **clear any pending reconnect timer** (otherwise a reconnection attempt fires after shutdown). Reconnect must use capped exponential backoff + jitter and tolerate `error`/`end` events (TODO requires this — call it out as a must, not a nice-to-have).

### B11. 🟢 `console` → `@nexus/logger`.
`config/kafka.ts` in auth & user uses `console.warn` (`auth:25`, `user:25`). The shared package already uses `@nexus/logger`. Migrate these to `createLogger({ serviceName, node_env })` (notification already does, `notification-service/src/config/kafka.ts`).

---

## C. Corrected migration template (STEP 3)

```sql
-- up
CREATE OR REPLACE FUNCTION notify_outbox_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('outbox_channel', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outbox_event_notify ON "outbox_events";

CREATE TRIGGER outbox_event_notify
AFTER INSERT ON "outbox_events"
FOR EACH ROW EXECUTE FUNCTION notify_outbox_event();

-- down
DROP TRIGGER IF EXISTS outbox_event_notify ON "outbox_events";
DROP FUNCTION IF EXISTS notify_outbox_event();
```
Notes: table is `outbox_events` (B1); channel constant `'outbox_channel'` must equal what `outboxListener` `LISTEN`s on (B4); idempotent via `OR REPLACE` + `IF EXISTS`. Place as a new timestamped migration folder per service (mirror existing `20260709160735_...` style).

---

## D. DO / DON'T for the working agent

**DO**
- Replace both per-service `publishDeadLetterEvent` with the shared helper (built on existing `buildDeadLetterEvent`); pass `serviceName` as a param — never hardcode `source`.
- Inject dependencies into the shared poller: `{ prisma-like outbox model, serviceName, logger, publish fn, resolveTopic fn, options }`. Decoupling `publish` makes it unit-testable (B3/B5).
- Keep the notification-service `deadLetterEntry` DB persistence **out of** the shared `publishDeadLetterEvent` — that helper publishes to the Kafka `DLQ` topic only; notification's table is consumer-side and stays put.
- Keep the two backoffs separate: shared `backoff.ts` = **deterministic** exponential (matches existing poller) for outbox retries; notification's **full-jitter** `backoff.ts` is for Resend API retries — different concern, out of scope (audit #6).
- Add `pg` + `@types/pg` to `packages/kafka` (B2).
- Add vitest + a few pure-function unit tests (B3).
- Preserve rethrow semantics in the producer path (B5).
- Wire `startOutboxPoller` + `OutboxListener` together in each service's `server.ts`; also add `stopOutboxPoller()` + `listener.stop()` to auth's shutdown (matches user-service, audit —).

**DON'T**
- Don't target `"OutboxEvent"` in the trigger — use `"outbox_events"` (B1).
- Don't make the listener process per-`id` payloads; treat NOTIFY as a wake-up and call the shared batch poll (B4).
- Don't couple `types.ts` `OutboxEvent` to `event-contracts.EventEnvelope` (B6).
- Don't "fix" producers to emit `EventEnvelope` — out of scope, breaks consumers (B6).
- Don't leave `KafkaTopics.COMMANDS`/`.NOTIFICATIONS` mappings — delete them (B7).
- Don't ship `rejectUnauthorized: false` in `createKafkaClient` for prod (B9).
- Don't leave `console.warn` in `config/kafka.ts` (B11).
- Don't delete the interval fallback — listener alone is not durable (TODO requirement, also B4).

---

## E. Suggested shared-package API shape (dependency-injected)

```ts
// packages/kafka/src/outboxPoller.ts
export interface OutboxPollerDeps {
  outbox: OutboxStore;            // structural: findPending/claim/markCompleted/markFailed
  serviceName: string;
  logger: Logger;                 // from @nexus/logger, tagged with serviceName
  publish: (topic: string, key: string, value: unknown, traceparent?: string) => Promise<void>;
  resolveTopic: (eventType: string) => string;
  options?: Partial<OutboxPollerOptions>;
}
export function createOutboxPoller(deps: OutboxPollerDeps): {
  start(): Promise<void>;
  stop(): Promise<void>;          // clears interval AND awaits in-flight batch
  processNextBatch(): Promise<void>; // shared by listener + interval
};

// packages/kafka/src/outboxListener.ts
export function createOutboxListener(deps: {
  channel: string;                // 'outbox_channel'
  getClient: () => Promise<PgClient>;
  onNotify: () => void;           // -> poller.processNextBatch() (throttled)
  logger: Logger;
}): { start(): Promise<void>; stop(): Promise<void> }; // UNLISTEN + end + clear reconnect timer
```
