# Outbox Delivery Simplification — Work Context

> Resume file. Regenerate after every step so work can continue from the last
> completed point if the session is interrupted.

## Goal (from TODO.md)
Remove Postgres LISTEN/NOTIFY (`OutboxListener`) entirely from `@nexus/kafka`.
Standardize every service on a uniform `OutboxPoller` interval of **5000ms**.
CockroachDB (used/planned for several services) does not support LISTEN/NOTIFY,
so a mixed per-service strategy adds complexity without benefit at this scale.

## Step status
- [x] STEP 1 — Audit (findings reported, confirmed by user)
- [x] STEP 2 — Remove listener infrastructure
- [x] STEP 3 — Standardize interval to 5000ms
- [x] STEP 4 — Update AGENTS.md
- [x] STEP 5 — Write ADR
- [ ] STEP 6 — Commits (IN PROGRESS — 5 logical chunks)

## Confirmed decisions (from user)
- ADR path: `docs/adr/` (authoritative repo rule in AGENTS.md).
- Trigger migrations: DELETE folders (predeploy, unapplied to any real DB).

## What was changed
### packages/kafka
- DELETED `src/outboxListener.ts` (the LISTEN/NOTIFY listener).
- `src/index.ts`: stops re-exporting `outboxListener`.
- `src/outboxInfrastructure.ts`: poller-only. Removed `OutboxListener` import +
  wiring; `OutboxInfrastructureDeps` no longer has `connectionString`/`channel`/
  `maxReconnectAttempts`; start/stop drive only the poller.
- `src/types.ts`: `OutboxPollerOptions` no longer has `minNotifyIntervalMs`;
  `DEFAULT_OUTBOX_POLLER_OPTIONS.fallbackPollIntervalMs = 5000`; docs rewritten
  (polling is the ONLY trigger, not a fallback).
- `src/outboxPoller.ts`: removed `handleNotification()` + `lastNotifyPollAt`;
  class doc rewritten to single-interval trigger.
- `tests/outboxInfrastructure.test.ts`: poller-only assertions (was listener-
  centric; dropped the stale `DATABASE_URL` throw test).
- `tests/outboxPoller.test.ts`: removed `minNotifyIntervalMs`; 2nd-drain test now
  uses stop/reset/start instead of `handleNotification`.
- `package.json`: description updated; dropped `pg` + `@types/pg` (dead).

### services
- `auth-service/src/events/outboxPoller.ts` + `user-service/src/events/
  outboxPoller.ts`: comment-only ("OutboxPoller + OutboxListener" →
  "OutboxPoller"). No API change — neither passed listener args.
- DELETED both `prisma/migrations/20260814000000_add_outbox_notify_trigger/`
  folders (auth + user).

### repo docs
- `AGENTS.md`: outbox line → "interval poller, 5s, uniform across all services
  regardless of DB provider…".
- `docs/adr/0001-outbox-delivery-strategy.md`: new ADR.

## Verification
- `pnpm -C packages/kafka run check-types` → passes (tsc --noEmit clean).
- `pnpm -C packages/kafka test` → 18 passed (5 files).
- Repo-wide grep: no remaining references to OutboxListener / outboxListener /
  handleNotification / minNotifyIntervalMs / outbox_channel / pg_notify /
  notify_outbox_event (only in TODO.md + this context.md, which describe the work).

## ⚠️ Pre-existing unrelated working-tree changes — DO NOT BUNDLE
These files were already modified before this task and are NOT part of the
outbox work. They remain uncommitted in the working tree and must be handled
separately by the user:
- `packages/kafka/src/backoff.ts`, `deadLetter.ts`, `eventBus.ts` — doc/comment
  stripping (likely a formatter pass).
- `packages/kafka/src/eventBus.ts` — BEHAVIORAL: `sslRejectUnauthorized`
  default flipped `true` → `false` (disables Kafka TLS cert verification).
  This is a security regression vs AGENTS.md ("Helmet + CORS locked…", secrets
  in env). Flag to user before any commit.
- `services/auth-service/src/server.ts` — minor refactor of eventBus.connect().

## Commits plan (logical chunks, per TODO Step 6)
1. docs: audit report (TODO.md + context.md reflect audit) — actually the audit
   is already in context.md; commit it together with the work. Better chunking:
   (a) refactor(kafka): remove LISTEN/NOTIFY listener, poller-only infra;
   (b) refactor(kafka): set uniform 5s poll interval;
   (c) docs: update AGENTS.md outbox delivery line;
   (d) docs: add ADR 0001 outbox delivery strategy;
   (e) refactor(services): drop OutboxListener comment + delete trigger migrations.
   Keep the 4 pre-existing files OUT of these commits.

## Resume point
Continue STEP 6: stage only the outbox-delivery files and create the 5 commits
above. Do NOT include backoff.ts/deadLetter.ts/eventBus.ts/auth server.ts.
