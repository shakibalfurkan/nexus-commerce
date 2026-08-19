TASK: Consolidate event contracts and outbox writer logic that is currently
duplicated and INCONSISTENT across auth-service, user-service, and
packages/event-contracts. This includes fixing a real correctness bug, not
just deduplicating.

CONTEXT:

- Three separate, conflicting definitions of domain event schemas currently
  exist: auth-service/src/events/eventTypes.ts, user-service equivalent, and
  packages/event-contracts — they disagree on envelope shape (nested
  `metadata: {emittedAt, source, version}` vs flat `producer`/`eventVersion`
  fields). Only one shape should exist, shared from packages/event-contracts.
- resolveTopic() is duplicated per-service as a large map, when in reality
  every event type routes to KafkaTopics.DOMAIN_EVENTS except
  "dead_letter.event" which routes to KafkaTopics.DLQ — this should be one
  trivial shared function, not a maintained per-service map.
- CRITICAL BUG: auth-service's writeOutboxEvent() has `tx` as an OPTIONAL
  second parameter that falls back to the global `prisma` client when
  omitted. This breaks the outbox pattern's core atomicity guarantee — the
  outbox insert MUST happen inside the same transaction as the business
  write, every time, with no silent fallback. user-service's version
  correctly requires `tx`. Fix auth-service to match: `tx` must be REQUIRED,
  not optional, with no fallback to a global client. This is a correctness
  fix, not a style preference.
- Signature order also differs (auth: event, tx, traceparent — user: tx,
  event, traceparent). Standardize on ONE order across all services.

STEP 1 — Audit before writing anything

- Find every service's local eventTypes.ts / event schema file, every
  writeOutboxEvent/emitDomainEvent implementation, every resolveTopic
  implementation
- Diff their envelope shapes, signatures, and behavior precisely — report
  every schema-shape and signature difference found, including which
  services actually validate incoming/outgoing events against which schema
  (confirm which schema version, if either, is actually enforced at runtime
  vs dead/unused code)
- Report findings, including the canonical envelope shape recommendation
  below, before proceeding to Step 2

STEP 2 — Restructure packages/event-contracts (currently dumped in one
index.ts) into multiple files, one per concern:
packages/event-contracts/src/
envelope.ts — canonical envelope shape: eventType, aggregateId,
payload, metadata: { emittedAt, source, version }.
This is the ONE shape every service uses — remove the
flat producer/eventVersion variant entirely.
topics.ts — KafkaTopics constant (already minimal, keep as-is)
events/
auth-events.ts — auth-service's produced event schemas
(email.verification.otp.sent, password.reset.requested,
seller.profile.requested, customer.profile.requested,
seller.profile.created, customer.profile.created)
user-events.ts — user-service's produced event schemas
(user.registered, user.deleted, user.hard_deleted,
user.restored, user.profile_updated, etc — reconcile
against what's actually implemented vs aspirational)
dlq-events.ts — dead_letter.event schema
index.ts — barrel file, re-exports only, zero logic

Every schema uses the SAME envelope shape from envelope.ts. Confirm with the
Step 1 audit which specific event types are actually produced/consumed today
vs which are placeholder/future — do not invent payload shapes for events
that don't have a real producer yet; flag those instead of guessing.

STEP 3 — Shared resolveTopic() (put in packages/kafka, since it's Kafka
routing logic, importing KafkaTopics from event-contracts)
Replace the per-service map entirely with:
export function resolveTopic(eventType: string): string {
return eventType === DLQEventTypes.DEAD_LETTER_EVENT
? KafkaTopics.DLQ
: KafkaTopics.DOMAIN_EVENTS;
}
Delete every per-service resolveTopic() and its eventTopicMap. Import the
shared one instead.

STEP 4 — Shared outbox writer (put in packages/kafka)
One implementation, `tx` REQUIRED (not optional, no fallback to a global
Prisma client — this is the bug fix), consistent signature order
`(tx, event, traceparent)`:
export async function writeOutboxEvent(
tx: PrismaTransaction,
event: TDomainEvent,
traceparent?: string,
): Promise<string> { ... }
export async function emitDomainEvent(
tx: PrismaTransaction,
event: TDomainEvent,
traceparent?: string,
): Promise<string> {
return writeOutboxEvent(tx, event, traceparent);
}
Delete both services' local versions. Update every call site to the
consistent (tx, event, traceparent) order — this WILL require touching
every call site in auth-service since its current order is reversed; do
this explicitly, do not skip call sites.

STEP 5 — Migrate every service

- Delete local eventTypes.ts files entirely, import event schemas from
  @nexus/event-contracts instead
- Delete local resolveTopic + eventTopicMap, import from packages/kafka
- Delete local writeOutboxEvent/emitDomainEvent, import from packages/kafka,
  fix all call sites for the corrected signature order
- notification-service's domainEventRegistry (template/subject mapping) is
  DIFFERENT from the schema contracts — it's notification-service's own
  business logic for how to render an event as an email, not a shared
  contract. Keep it local to notification-service, but make sure the event
  TYPES it switches on are imported from @nexus/event-contracts, not
  redefined locally
- Verify each service still builds after migration

STEP 6 — Commits

- Commit in logical, working chunks
- Suggested sequence: (1) audit report, (2) restructure event-contracts into
  canonical multi-file shape, (3) shared resolveTopic in packages/kafka,
  (4) shared outbox writer in packages/kafka with the tx-required fix,
  (5) migrate auth-service (most call-site changes due to signature reorder),
  (6) migrate user-service, (7) migrate remaining services,
  (8) delete all dead local files
- Each commit message: concise, present tense, explains why
  (e.g. "fix(auth): require tx in outbox writer — optional tx silently broke
  transactional atomicity guarantee")
- Do not commit broken/non-building intermediate states

Confirm the Step 1 audit findings — especially which envelope shape is
actually enforced today and which events are real vs placeholder — with me
before proceeding to Step 2.
