# Event Contract Consolidation — Work State

> Resumable across sessions. Status reflects audit (Step 1) complete; Steps 2-6
> NOT started (blocked on user confirmation of findings per TODO.md).

## Goal
Consolidate duplicated/inconsistent domain-event contracts + outbox logic across
auth-service, user-service, packages/event-contracts, and packages/kafka. Includes
a real correctness bug fix (auth outbox `tx` must be REQUIRED, no global fallback).

## Repo map (audited files)
- `packages/event-contracts/src/index.ts` — FLAT envelope + per-event schemas + `createEventEnvelope`.
- `packages/kafka/src/{types,index,eventBus,deadLetter,outboxPoller}.ts` — shared Kafka infra; barrel-only `index.ts`.
- `services/auth-service/src/events/{eventTypes,outboxWriter,eventBus,outboxPoller}.ts`
- `services/user-service/src/events/{eventTypes,outboxWriter,eventBus,outboxPoller}.ts`
- `services/notification-service/src/events/domain-event.schemas.ts` + `src/types/kafka-message.types.ts` + `src/events/domain-event.consumer.ts` + `src/services/dlq.ts`

---

## STEP 1 — AUDIT FINDINGS (final)

### F1. THREE envelope shapes; only ONE is real (the nested `metadata` shape)
| Source | Envelope shape | Status |
|---|---|---|
| `event-contracts` `index.ts` | FLAT: `eventId, eventType, eventVersion, occurredAt, producer, correlationId?, causationId?, traceparent?, payload` | **DEAD CODE** — never imported anywhere at runtime |
| auth `eventTypes.ts` | `eventType, aggregateId, payload, metadata:{emittedAt, source, version}` | **LIVE / wire** |
| user `eventTypes.ts` | same nested shape | **LIVE / wire** |
| notification `domain-event.schemas.ts` | same nested shape (`aggregateId`, `payload`, `metadata:{emittedAt, source, version}`); strict `z.uuid()`/`z.email()`/`z.iso.datetime()` | **LIVE / wire (consumer)** |
| `packages/kafka/deadLetter.ts` | builds nested `metadata` shape for DLQ | **LIVE** |

- `event-contracts` is imported ONLY for `KafkaTopics` + `DLQEventTypes` (grep-confirmed: 0 imports of `DomainEventSchema`/`*EventSchema`/`createEventEnvelope` outside its own `index.ts`).
- `createEventEnvelope()` helper in event-contracts is unused.
- **Conclusion:** the nested `metadata:{emittedAt, source, version}` shape is the real wire format (producers + consumer + DLQ all agree). The TODO's canonical recommendation (`eventType, aggregateId, payload, metadata:{emittedAt, source, version}`) is correct. The flat `eventId/producer/occurredAt/eventVersion/correlationId/causationId` variant must be deleted entirely.

### F2. Schema-strictness inconsistencies (must reconcile in Step 2)
- `aggregateId`: auth `eventTypes` uses `z.string()` (loose); user `eventTypes` uses `z.uuid()`; notification uses `z.uuid()`. Standardize on `z.string()` for the shared contract? Recommend `z.string()` to avoid breaking auth's `uuidv5(email,...)` (valid uuid) — actually uuidv5 IS a uuid, so `z.uuid()` is fine. Decide: use `z.string()` to be permissive at the boundary OR `z.uuid()`. **Flag for user.** Default: `z.string()` to match the loosest producer and not reject any existing valid aggregateId.
- Per-field payload validations differ (notification stricter: `z.email()`, `z.iso.datetime()`). The shared contract should define payload shapes; notification's stricter consumer-side validation can stay local (it's its own boundary concern). See F5.

### F3. CRITICAL BUG — auth `tx` is OPTIONAL with global fallback (real, in action)
- `auth-service/src/events/outboxWriter.ts`:
  `writeOutboxEvent(event, tx?, traceparent?)` → `const prismaClient = tx ? tx : prisma;` then writes via `prismaClient.outboxEvent.create`.
- All 5 auth call sites call `emitDomainEvent({...})` with NO `tx`:
  - `auth.service.ts:178` (registerRequest), `:306` (resendOtp)
  - `auth.service.ts:569` (requestPasswordReset)
  - `auth.service.ts:649` (provisionSeller), `:686` (provisionCustomer)
  - `customer.service.ts:76` (registerCustomer/otp path)
- Impact: outbox insert runs on the GLOBAL `prisma` client, NOT inside any business transaction → breaks atomicity guarantee. A business write can commit while the outbox insert fails (or vice-versa), losing the event or double-emitting. This is exactly the bug the TODO describes.
- Fix (Step 4): make `tx` REQUIRED, delete the `prisma` import + fallback. `emitDomainEvent(tx, event, traceparent?)`.

### F4. Signature order differs
- auth: `(event, tx?, traceparent?)` — reversed.
- user: `(tx, event, traceparent?)`.
- Canonical (TODO Step 4): `(tx, event, traceparent?)`. Auth call sites must be reordered + given a real `tx` (see F3/F6).

### F5. `resolveTopic` — duplicated per-service map, trivially collapsible
- auth `outboxWriter.ts` + user `outboxWriter.ts` each define an `eventTopicMap` + `resolveTopic` that is identical in behavior: every key → `DOMAIN_EVENTS`, `dead_letter.event` → `DLQ`.
- Both already fall back to `DOMAIN_EVENTS` for unknown types, so the map is pure noise.
- README/ADR note: a prior author already deleted `COMMANDS`/`NOTIFICATIONS` topic keys (they referenced non-existent `KafkaTopics` — only `DOMAIN_EVENTS` + `DLQ` exist).
- Fix (Step 3): one shared `resolveTopic(eventType)` in `packages/kafka`, importing `KafkaTopics` + `DLQEventTypes` from event-contracts. Delete both per-service maps.

### F6. Real vs PLACEHOLDER events (do NOT invent payloads for placeholders)
**auth-service — ACTUALLY EMITTED (producers exist):**
- `email.verification.otp.sent` (3 sites)
- `password.reset.requested`
- `seller.profile.requested`
- `customer.profile.requested`

**auth-service — DEFINED but NEVER EMITTED (placeholder):** `seller.profile.created`, `customer.profile.created`. No producer code. → FLAG, don't invent payload; consider dropping from canonical contract or keeping schema-only with a clear "no producer yet" note. **Flag for user.**

**user-service — ACTUALLY EMITTED:** `user.registered` (in `createUserProfile`, correctly inside `$transaction` with `tx`).

**user-service — DEFINED but NEVER EMITTED (placeholder):** `user.deleted`, `user.hard_deleted`, `user.restored`, `user.profile_updated`, `user.password_changed`, `user.email_changed`, `user.role_changed`, `user.locked`, `user.unlocked`, `order.placed`, `payment.succeeded`. NOTE: `deleteUser`/`hardDeleteUser`/`restoreUser` exist but only write audit logs — they do NOT call `emitDomainEvent` at all. → FLAG, don't invent payloads. **Flag for user.**

**notification-service — CONSUMES:** `email.verification.otp.sent`, `password.reset.requested`, `user.registered` (its `DomainEventNames` + registry). Matches real producers.

### F7. BROKEN/DANGLING import in user-service
- `user.service.ts:7-9` imports `emitNotificationEvent` from `../../events/outboxWriter.js`.
- `outboxWriter.ts` exports ONLY `resolveTopic`, `writeOutboxEvent`, `emitDomainEvent`. No `emitNotificationEvent` exists anywhere in the repo (grep-confirmed: 0 definitions, 0 calls).
- This is a dangling import → user-service currently does NOT type-check/build cleanly (or `emitNotificationEvent` is `undefined` at runtime if TS is lenient). Must be resolved in Step 5 (remove the unused import).

### F8. notification-service registry is local business logic — keep local
- `domainEventRegistry` (templateKey / extractRecipient / getSubject) is notification's own rendering logic, NOT a shared contract. Per TODO Step 5: keep local, but import the EVENT TYPES/shapes it switches on from `@nexus/event-contracts` rather than redefining. Currently it has its own copy of the nested-shape schemas → should import the canonical nested-shape schemas from the restructured event-contracts.

---

## Canonical envelope decision (TODO recommendation — endorsed by F1)
```
eventType:  string (literal per event)
aggregateId: string            // permissive by default (see F2)
payload:    <per-event object>
metadata:   { emittedAt: string; source: string; version: number }
```
- `traceparent` is NOT in the body — it travels in Kafka HEADERS; outbox writer keeps it as a separate param + column.
- Delete flat `eventId/producer/occurredAt/eventVersion/correlationId/causationId` from event-contracts.

## Open questions for user (blocking Step 2)
1. **Placeholder events** (`seller.profile.created`, `customer.profile.created`, and the 9 unused `user.*` types + `order.placed`/`payment.succeeded`): include schema-only in the canonical contract (clearly marked "no producer yet") or drop them entirely? My recommendation: drop `seller/customer.profile.created` (no producer, and per AGENTS.md no payment/order service exists yet → drop `order.placed`/`payment.succeeded`); keep `user.*` delete/restore/types as schema-only markers OR drop — recommend DROP the unused `user.*` ones too, since no producer + no consumer. Awaiting your call.
2. **`aggregateId` strictness** (F2): `z.string()` (permissive, matches loosest producer) vs `z.uuid()` (matches user/notification). Recommend `z.string()` to avoid rejecting valid aggregateIds at the contract boundary.
3. **auth call-site `tx`** (F3/F6): auth currently emits outside any transaction. Making `tx` REQUIRED means wrapping each emit in a `prisma.$transaction` (or passing the tx from an enclosing transaction). Confirm approach: wrap each of the 5 auth emit sites in `prisma.$transaction(async (tx) => { ...emitDomainEvent(tx, ...) })`.

## State
- Step 1: ✅ complete (findings above).
- Steps 2-6: ⏸ blocked on user confirmation of the 3 open questions + audit sign-off.
- No files changed yet.
