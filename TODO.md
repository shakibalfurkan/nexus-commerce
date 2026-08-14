TASK: Refactor outbox/event infrastructure into packages/kafka as a shared, production-grade package. This code currently exists duplicated across multiple services (notification-service, user-service, and others) and must be consolidated. Also implement Postgres LISTEN/NOTIFY as a new capability that doesn't exist yet.

CONTEXT:

- Monorepo: Turborepo, pnpm workspaces
- packages/kafka already exists and currently contains EventBus (Kafka producer/consumer wrapper) — review this first for correctness and improve it before building on top of it
- Each service has its own duplicated OutboxPoller implementation with copy-paste bugs (e.g. hardcoded wrong service names in DLQ publish calls — audit for this specifically across all services)
- No OutboxListener (Postgres LISTEN/NOTIFY) exists yet anywhere — this is new code to write, not a refactor
- Shared event contracts/enums (including KafkaTopics) live in packages/event-contracts — do not duplicate topic names inside packages/kafka, import from event-contracts instead
- Each service owns its own database (outbox pattern requirement) — the trigger migration SQL is per-service (not shared code), but the listener client logic in packages/kafka is shared

STEP 1 — Audit before writing anything

- Find every service with outbox poller / DLQ publish logic
- Diff them against each other, document every divergence (hardcoded strings, different retry configs, inconsistent field names, bugs like wrong service name in log/DLQ payloads)
- Report findings before proceeding to Step 2

STEP 2 — Build packages/kafka structure (one file per concern, never dump into index.ts)
packages/kafka/src/
eventBus.ts — review existing EventBus, fix any issues found, improve typing
outboxPoller.ts — generic engine, accepts Prisma client instance + OutboxPollerOptions as parameters, no hardcoded service name or table assumptions
outboxListener.ts — new: Postgres LISTEN/NOTIFY implementation using raw `pg` Client, with auto-reconnect on connection drop/error, exponential backoff on reconnect attempts, clean UNLISTEN + close on shutdown
backoff.ts — calculateBackoff() extracted as standalone, unit-testable, pure function
deadLetter.ts — publishDeadLetterEvent() helper, service name passed as parameter, never hardcoded
types.ts — OutboxPollerOptions, OutboxEvent shape, shared interfaces
index.ts — barrel file that only re-exports from the above, contains zero logic itself

REQUIREMENTS:

- OutboxPoller must accept: Prisma client, service name, and options as constructor/function params — must work identically for any service's OutboxEvent table (assume consistent schema shape across services, call this out if it isn't true)
- Combine listener (primary trigger) + slow interval poll (safety-net fallback, default 30s) — do not remove the interval-based fallback entirely; the listener alone is not durable since NOTIFY is fire-and-forget and drops messages sent while disconnected
- All public functions must have explicit return types (no implicit any)
- Add JSDoc comments explaining WHY for non-obvious logic (e.g. why the fallback poll exists, why isBatchProcessing lock matters) — not just WHAT
- Handle connection failure, malformed payloads, and Kafka publish errors as distinct, explicitly typed error paths — don't swallow errors into generic catches
- No console.log — use the existing logger utility pattern already established in services

STEP 3 — Postgres trigger migrations (per service, not shared)
For each service using the outbox pattern, add a migration using this exact template (keep function/trigger names identical across services — each service has its own isolated DB so there's no collision, and identical naming removes any guesswork):

CREATE OR REPLACE FUNCTION notify_outbox_event() RETURNS trigger AS $$
BEGIN
PERFORM pg_notify('outbox_channel', NEW.id::text);
RETURN NEW;
END;

$$
LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS outbox_event_notify ON "OutboxEvent";

  CREATE TRIGGER outbox_event_notify
AFTER INSERT ON "OutboxEvent"
FOR EACH ROW EXECUTE FUNCTION notify_outbox_event();

Include the down migration (DROP TRIGGER / DROP FUNCTION) for rollback safety. Use DROP TRIGGER IF EXISTS / CREATE OR REPLACE FUNCTION so the migration is idempotent and safe to re-run — do not write non-idempotent DDL that fails on shadow-DB replay.

STEP 4 — Migrate each service to use the shared package
- Replace each service's local outbox poller file with an import from packages/kafka
- Wire startOutboxPoller() calls to pass service-specific config (service name, poll interval, batch size) as params
- Apply the trigger migration for that service's database
- Wire OutboxListener into that service's startup alongside the poller (listener = primary trigger, interval poll = fallback)
- Delete the now-dead duplicated code entirely — do not leave old files "just in case"
- Verify each service still builds and its existing tests (if any) still pass after migration

STEP 5 — Commits
- Commit in logical, working chunks — not one giant commit at the end
- Suggested sequence: (1) review + fix EventBus, (2) add outboxPoller.ts + backoff.ts + deadLetter.ts as generic package code, (3) add outboxListener.ts as new feature, (4) add trigger migration template + apply to service #1 as proof-of-concept, (5) migrate remaining services one by one or in a batch, (6) delete dead duplicated code
- Each commit message: concise, present tense, explains the "why" not just "what" (e.g. "refactor: extract outbox poller into shared package to eliminate per-service duplication and fix hardcoded service-name bug in DLQ payloads")
- Do not commit broken/non-building intermediate states — each commit should leave the repo in a working state

Confirm the audit findings from Step 1 with me before proceeding to Step 2.
$$
