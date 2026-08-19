# 0001 — Outbox Delivery Strategy

- Status: Accepted
- Date: 2026-08-19
- Deciders: Nexus engineering

## Context

The outbox pattern is used by every service that publishes domain events to
Kafka (currently `auth-service`, `user-service`; more planned). A write to the
`outbox_events` table and the downstream Kafka publish must be decoupled so a
crash between the DB commit and the publish never loses an event — the outbox is
drained asynchronously by a worker that reads PENDING rows and publishes them.

An outbox needs a **trigger** that wakes the drainer. Initially this was
implemented two ways in the shared `@nexus/kafka` package:

1. A Postgres **LISTEN/NOTIFY listener** (`OutboxListener`) as the near-real-time
   primary trigger — an `AFTER INSERT` trigger on `outbox_events` fired
   `pg_notify('outbox_channel', id)` and a dedicated `pg` client LISTENed and
   woke the poller.
2. A slower **interval poller** (`OutboxPoller`) — every 30s — as a
   durability safety net for events written while the listener was
   disconnected (NOTIFY is fire-and-forget and drops messages sent while no
   listener is subscribed).

## Problem

Several services run (or will run) on **CockroachDB**, which does **not**
support Postgres LISTEN/NOTIFY. Supporting it would force a **mixed per-service
delivery strategy**: services on Postgres could use the listener, services on
CockroachDB could not. That means two code paths, two operational models, and
per-service documentation of "which delivery mechanism does this service use"
— complexity with no proportional benefit at this project's scale (low-to-
moderate event volume, free-tier infra).

A separate cost: the listener required a dedicated non-pooled `pg` connection
per service, plus a trigger function + trigger per database, and a reconnect/
backoff implementation. All of it exists only to shave latency under the
poller's interval.

## Decision

Standardize on a **single, uniform interval poller** across every service.

- Remove `OutboxListener` and the LISTEN/NOTIFY wiring entirely.
- Remove the NOTIFY trigger migration (`notify_outbox_event()` +
  `outbox_event_notify`) from every service.
- Every service constructs `OutboxPoller` directly and passes a `publish`
  function it builds itself (wrapping its own `EventBus.publish`, with a
  logged no-op fallback when Kafka is unconfigured). There is no shared
  `createOutboxInfrastructure` wrapper — the package exports `OutboxPoller` as
  the public outbox API.
- Interval is **single fixed 5 seconds**
  (`DEFAULT_OUTBOX_POLLER_OPTIONS.fallbackPollIntervalMs = 5000`), with **no
  per-service overrides** unless a service has a documented, reviewed reason
  to differ.

Polling is the only trigger, applied consistently regardless of DB provider.

## Consequences

- **Latency:** events are delivered up to ~5s after the DB commit, versus
  near-immediate under NOTIFY. Acceptable for this system's event semantics.
- **Simplicity:** one delivery mechanism to reason about, test, and operate
  across heterogeneous DB providers. No dedicated listener connection, no
  trigger function, no reconnect/backoff code in the hot path.
- **Durability:** unchanged — the poller's claim/PROCESSING/`lockTimeoutMs`
  lock already guarantees no lost or double-delivered events; removing the
  listener removes only the low-latency fast path, not the safety net.
- **CockroachDB compatibility:** the outbox now works identically on Postgres and
  CockroachDB with zero provider-specific branching.
- **Tradeoff accepted:** we deliberately trade sub-second wake-up latency for one
  consistent, simpler mechanism. If a future service genuinely needs lower
  latency, that is a new, documented decision — not a silent per-service fork.
