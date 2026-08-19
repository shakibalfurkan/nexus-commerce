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
- [x] STEP 6 — Commits (DONE: 5 logical chunks in prior session)
- [x] REDESIGN — remove `createOutboxInfrastructure` wrapper entirely (user update)

## Confirmed decisions (from user)
- ADR path: `docs/adr/` (authoritative repo rule in AGENTS.md).
- Trigger migrations: DELETE folders (predeploy, unapplied to any real DB).
- REDESIGN: NO `createOutboxInfrastructure` wrapper. Services import
  `OutboxPoller` directly from `@nexus/kafka`, build their own `publish` fn in
  their `eventBus.ts`, and call `new OutboxPoller({ prisma, serviceName,
  resolveTopic, publish, logger, options })`.

## What was changed
### packages/kafka
- DELETED `src/outboxListener.ts` (the LISTEN/NOTIFY listener).
- `src/index.ts`: no longer re-exports `outboxListener` OR `outboxInfrastructure`.
- DELETED `src/outboxInfrastructure.ts` + `tests/outboxInfrastructure.test.ts`
  (the `createOutboxInfrastructure` wrapper is gone entirely).
- `src/types.ts`: `OutboxPollerOptions` no longer has `minNotifyIntervalMs`;
  `DEFAULT_OUTBOX_POLLER_OPTIONS.fallbackPollIntervalMs = 5000`; docs rewritten
  (polling is the ONLY trigger, not a fallback).
- `src/outboxPoller.ts`: removed `handleNotification()` + `lastNotifyPollAt`;
  class doc rewritten to single-interval trigger.
- `tests/outboxPoller.test.ts`: removed `minNotifyIntervalMs`; 2nd-drain test now
  uses stop/reset/start instead of `handleNotification`.
- `package.json`: description updated; dropped `pg` + `@types/pg` (dead).

### services
- `auth-service/src/events/eventBus.ts` + `user-service/src/events/eventBus.ts`:
  add `publishOutboxEvent` — wraps the service's single `EventBus.publish`
  (rethrows so the poller retries/DLQs) with a logged no-op when `eventBus` is
  `null` (Kafka unconfigured). Signature matches `OutboxPublishFn`.
- `auth-service/src/events/outboxPoller.ts` + `user-service/src/events/
  outboxPoller.ts`: now `new OutboxPoller({ prisma, serviceName, resolveTopic,
  publish: publishOutboxEvent, logger })`; start/stop re-exported unchanged.
- DELETED both `prisma/migrations/20260814000000_add_outbox_notify_trigger/`
  folders (auth + user).

### repo docs
- `AGENTS.md`: outbox line → "interval poller, 5s, uniform across all services
  regardless of DB provider…" (does NOT name createOutboxInfrastructure).
- `docs/adr/0001-outbox-delivery-strategy.md`: Decision now states services
  construct `OutboxPoller` directly (no wrapper); package exports `OutboxPoller`
  as the public outbox API.

## Verification (after redesign)
- `pnpm -C packages/kafka run check-types` → passes.
- `pnpm -C packages/kafka test` → 17 passed (4 files; infra test deleted).
- `auth-service` tsc --noEmit → passes.
- `user-service` tsc --noEmit → ERRORS, BUT pre-existing & unrelated: they are in
  `src/modules/user/user.repository.ts` (missing `referralCode`, unknown
  `shopName`, `AuditLog` actorEmail/actorDisplayName, `SellerProfileInclude`),
  which this task never touched (git diff shows zero changes there). Root cause:
  working-tree schema/generated-client drift. NOT introduced by this change.
- Repo-wide grep: no remaining `createOutboxInfrastructure` / `OutboxInfrastructure`
  / `OutboxInfrastructureDeps` outside TODO.md + this context.md.

## ⚠️ Pre-existing unrelated working-tree changes (USER'S MANUAL WORK)
These files were modified by the user before/outside this task and are NOT part
of the outbox work. Per the user's latest instruction they should now ALSO be
committed (separately from the outbox refactor):
- `packages/kafka/src/backoff.ts`, `deadLetter.ts`, `eventBus.ts` — doc/comment
  stripping (likely a formatter pass).
- `packages/kafka/src/eventBus.ts` — BEHAVIORAL: `sslRejectUnauthorized`
  default flipped `true` → `false` (disables Kafka TLS cert verification).
  NOTE: this is a security regression vs AGENTS.md; flag to user before merge.
- `services/auth-service/src/server.ts` — minor refactor of eventBus.connect().

## Commits plan
1. (PRIOR SESSION, DONE) outbox delivery: listener removal, AGENTS.md, ADR,
   service wiring — 5 commits on main.
2. (THIS SESSION) refactor(kafka): delete createOutboxInfrastructure wrapper,
   drop its barrel export + test.
3. (THIS SESSION) refactor(services): services build publishOutboxEvent in
   eventBus.ts and construct OutboxPoller directly in outboxPoller.ts.
4. (THIS SESSION) docs: ADR 0001 updated to "no wrapper, OutboxPoller is the
   public API" + context.md.
5. (THIS SESSION) User's manual changes: backoff.ts/deadLetter.ts/eventBus.ts/
   auth server.ts — committed separately, clearly scoped.

## Resume point
All design work complete. Run the 4 commits above, then report. Do NOT mix the
outbox refactor with the user's manual changes in a single commit.
