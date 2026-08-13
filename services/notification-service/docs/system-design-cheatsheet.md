# Notification Service — System Design Interview Cheat Sheet

> A concise architectural reference for the Nexus Notification Service. Built
> for a $200k+ senior engineering showcase — every decision here is defensible
> in a system design interview.

---

## 1. Why "Exactly-Once Delivery" Is Impossible

### The Fundamental Problem

"Exactly-once delivery" (EOD) — the guarantee that a message is processed
**exactly one time, no more, no less** — is **impossible** in distributed
systems. Here's why:

### 1.1 The Two Generals Problem

Two armies need to coordinate an attack. General A sends a messenger: "Attack at
dawn." General B must acknowledge. But the acknowledgment messenger might be
captured. General A must acknowledge the acknowledgment. This recurses
infinitely — **there's no finite protocol that guarantees both parties agree on
a single truth over an unreliable channel.**

**Kafka is an unreliable channel.** The network between the broker and the
consumer can drop, delay, or duplicate messages. No amount of Kafka
configuration can change the laws of distributed systems.

### 1.2 The Consensus Impossibility

Even with a reliable channel, achieving EOD requires distributed consensus: all
replicas must agree on whether a message was processed. The FLP Impossibility
Result (Fischer, Lynch, Paterson, 1985) proves that **no asynchronous protocol
can guarantee consensus if even one process can fail.**

Kafka's `read_committed` + transactional producer gives "exactly-once
**processing**" within the Kafka ecosystem (consumer → produce → commit offset
in one transaction). But the moment you **side-effect outside Kafka** (write to
a database, send an email), the transaction boundary breaks — the external
system can't participate in Kafka's transaction coordinator.

### 1.3 The Crash Window

```
Consumer receives message → writes to DB → crashes before acknowledging offset
                                ↓
                    Kafka redelivers the message
                                ↓
                    Consumer processes it AGAIN
```

No matter where you put the checkpoint, there's always a window where a crash
causes either a duplicate or a loss. This is the **at-least-once vs.
at-most-once trade-off** — you can't have both.

### 1.4 What Kafka Actually Guarantees

| Kafka Feature             | What It Means                     | What It Doesn't Mean                           |
| ------------------------- | --------------------------------- | ---------------------------------------------- |
| `enable.idempotence=true` | Producer won't duplicate on retry | Consumer won't receive duplicates              |
| Consumer groups           | Offset-based tracking             | Offsets can be replayed                        |
| Transactions              | Atomic produce + offset commit    | Atomic produce + external side-effect          |
| `read_committed`          | Only read committed transactions  | No duplicate delivery across consumer restarts |

**Bottom line:** Kafka provides at-least-once delivery by default. EOD is only
achievable within Kafka's transaction boundary — not across external systems.

---

## 2. How This Architecture Handles Failures

### 2.1 At-Least-Once + Idempotency = Effectively-Once

Since EOD is impossible, we embrace **at-least-once delivery** and make every
consumer **idempotent**. The result is **effectively-once processing** —
duplicates are detected and skipped, so the business outcome is as if the
message was processed exactly once.

**Implementation:**

```
Kafka delivers message (possibly duplicate)
        ↓
claimNotification() — INSERT INTO notification_logs (eventId, ...)
        ↓
eventId is @unique (Kafka aggregateId)
        ↓
Duplicate INSERT → Prisma P2002 (unique constraint violation)
        ↓
Caught → return { status: "duplicate" } → skip
```

The `NotificationLog.eventId` column has a `@unique` constraint. The Kafka
envelope's `aggregateId` (a per-event UUID) is used as the idempotency key. A
duplicate insert raises a unique-constraint violation, which is caught and
treated as "already processed."

### 2.2 Error Classification — Retryable vs. Non-Retryable

Not all errors should trigger retries. The `EmailProviderError` class carries a
`retryable` flag:

| Error Type           | `retryable` | Action                                                       |
| -------------------- | ----------- | ------------------------------------------------------------ |
| 4xx (except 429)     | `false`     | Non-retryable — bad request, invalid recipient. Don't retry. |
| 429 (rate limited)   | `true`      | Retryable — transient, backoff needed.                       |
| 5xx (server error)   | `true`      | Retryable — provider issue, backoff needed.                  |
| Network timeout      | `true`      | Retryable — transient, backoff needed.                       |
| Circuit breaker open | `true`      | Retryable — but wait for reset timeout.                      |

This prevents infinite retries on permanent failures (e.g., sending to an
invalid email address) while ensuring transient failures are retried.

### 2.3 Exponential Backoff + Full Jitter

Retries use **full jitter** (AWS recommended strategy):

```
delay = random(0, min(baseDelay * 2^attempt, maxDelay))
```

- **Exponential growth**: `baseDelay` doubles each attempt (1s → 2s → 4s → ...)
- **Max cap**: `maxDelay` (30s) prevents multi-minute waits
- **Full jitter**: random component prevents **thundering herd** — if 100
  consumers retry simultaneously, they spread across the delay window instead of
  all hitting the provider at once

**Max attempts: 3** (per `.clinerules` §6). After 3 failed attempts, the
notification is routed to the DLQ.

### 2.4 Circuit Breaker

The `CircuitBreaker` wraps the Resend API call with a CLOSED/OPEN/HALF_OPEN
state machine:

```
CLOSED (normal)
    ↓ 5 consecutive failures
OPEN (fast-fail — throw CircuitBreakerError immediately)
    ↓ after resetTimeoutMs (30s)
HALF_OPEN (single test request)
    ↓ success → CLOSED    ↓ failure → OPEN
```

**Why:** If Resend is down, retrying 3 times per message wastes resources and
slows the consumer. The circuit breaker fast-fails, preventing cascading
failures. The `shouldTrip` predicate only counts retryable errors (5xx, 429,
network) — non-retryable 4xx errors are client mistakes, not provider failures.

### 2.5 Dead Letter Queue (DLQ)

After `maxRetries` (3) failed attempts, the notification is routed to the DLQ:

1. **`NotificationLog` status → `DLQ`** — the log tracks the final state
2. **`DeadLetterEntry` record created** — persists the raw event payload,
   failure reason, and attempt count. Survives Kafka retention expiry.
3. **Published to Kafka `dead-letter-queue` topic** — for downstream
   alerting/re-drive consumers

**Never silently drops a message** (`.clinerules` §6). The DLQ entry supports
manual re-drive via an admin tool — the raw payload is preserved for debugging
without the original Kafka message.

### 2.6 Rate Limiting — Redis Sliding Window

Per-recipient rate limiting prevents abuse (max 5 verification emails/hour):

```
Key: notification:ratelimit:email:{eventType}:{sha256(recipient)}
```

- **Sliding window via ZSET**: `ZREMRANGEBYSCORE` (remove expired) → `ZCARD`
  (count) → `ZADD` (add current) — all in a single **atomic Lua script**
- **SHA-256 hashed recipient**: no PII in Redis keys
- **Strict namespacing**: `notification:ratelimit:*` — clean service boundaries
  on the shared Upstash instance
- **TTL on every key**: no memory leaks

### 2.7 Error Strategy — Before vs. After Log Creation

The service layer distinguishes between two error phases:

| Phase                   | Error Example                                                   | Action                                                                           |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Before log creation** | `parseKafkaMessage` fails, `claimNotification` throws non-P2002 | **Throw** → KafkaJS redelivers the message                                       |
| **After log creation**  | Rate limit exceeded, template render fails, email send fails    | **Catch** → mark FAILED, return result → KafkaJS acknowledges (log tracks retry) |

This ensures:

- Malformed messages are retried by Kafka (not silently dropped)
- Processing failures are tracked in the DB (not lost on redelivery)
- The idempotency guard prevents duplicate processing on redelivery

---

## 3. Architecture Diagram (Text)

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Kafka     │────▶│  Kafka Consumer  │────▶│ Notification │
│ domain-     │     │ (kafka-consumer) │     │   Service    │
│ events      │     │                  │     │ (domain layer)│
└─────────────┘     └──────────────────┘     └──────┬───────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────┐
                    │                                 │                     │
                    ▼                                 ▼                     ▼
           ┌──────────────┐              ┌──────────────────┐      ┌──────────────┐
           │ Idempotency  │              │  Rate Limiter    │      │  Template    │
           │ (claimNotif) │              │  (Redis ZSET)    │      │  Engine      │
           │              │              │  + Lua script    │      │  (React Email)│
           │ P2002 → skip │              └──────────────────┘      └──────┬───────┘
           └──────┬───────┘                                                │
                  │                                                        ▼
                  ▼                                              ┌──────────────────┐
           ┌──────────────┐              ┌──────────────────┐      │  Email Provider │
           │ Notification │              │  Circuit Breaker │─────▶│  (Resend HTTP)  │
           │ Log (Prisma) │◀─────────────│  + retryWithBackoff│     │                  │
           │              │              │                  │      └──────────────────┘
           │ PENDING →   │              └──────────────────┘
           │   SENT/FAILED│
           └──────┬───────┘
                  │
                  ▼ (maxRetries exceeded)
           ┌──────────────┐
           │  DLQ Handler │
           │              │
           │ 1. Log → DLQ │
           │ 2. DeadLetterEntry │
           │ 3. Kafka DLQ topic │
           └──────────────┘
```

---

## 4. Key Trade-offs

| Decision                              | Trade-off                          | Rationale                                                        |
| ------------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| At-least-once + idempotency           | Duplicates possible, but skipped   | EOD is impossible; idempotency is the pragmatic alternative      |
| In-memory circuit breaker             | Per-instance state, not shared     | Free-tier single instance; local optimization is safe            |
| Full jitter backoff                   | Retry delay can be 0ms             | Maximizes spread; AWS recommended; prevents thundering herd      |
| `as never` type casts                 | Bypasses TS correlated-union check | TS#30581 limitation; registry guarantees runtime safety          |
| Conditional spread for optional props | Verbose code                       | `exactOptionalPropertyTypes` compliance; no `undefined` passed   |
| React Email over EJS                  | Larger bundle, React dependency    | JSX auto-escaping → HTML injection prevention for free           |
| Raw fetch over Resend SDK             | More boilerplate                   | No SDK leak into core logic; swapping providers touches one file |

---

## 5. Failure Scenarios

### 5.1 Kafka Redelivers a Duplicate

```
1. Consumer receives event A → claimNotification → PENDING log created
2. Consumer crashes before acknowledging offset
3. Kafka redelivers event A
4. claimNotification → P2002 (eventId already exists) → { status: "duplicate" }
5. Event skipped, no duplicate email sent
```

### 5.2 Resend API is Down (5xx)

```
1. Consumer receives event → claim → PENDING log
2. CircuitBreaker.execute(retryWithBackoff(send))
3. Attempt 1: 503 → retryable → backoff (random 0-1s)
4. Attempt 2: 503 → retryable → backoff (random 0-2s)
5. Attempt 3: 503 → retryable → throw (last attempt)
6. markAsFailed → attemptCount=1, nextRetryAt=now+backoff
7. Return { status: "failed" } → KafkaJS acknowledges
8. After 5 consecutive failures → CircuitBreaker OPEN → fast-fail
9. Scheduled re-drive picks up FAILED logs after nextRetryAt
```

### 5.3 Invalid Email Address (4xx)

```
1. Consumer receives event → claim → PENDING log
2. CircuitBreaker.execute(retryWithBackoff(send))
3. Attempt 1: 422 → non-retryable → throw immediately
4. markAsFailed → attemptCount=1
5. After 3 attempts (across re-drives) → routeToDlq
6. DeadLetterEntry created with failure reason
```

### 5.4 Rate Limit Exceeded

```
1. Consumer receives 6th verification email for same recipient within 1 hour
2. claim → PENDING log
3. RateLimiter.check() → { allowed: false, retryAfterMs: 1800000 }
4. markAsFailed → "Rate limit exceeded. Retry after 1800s."
5. Return { status: "failed" } → KafkaJS acknowledges
6. Scheduled re-drive retries after rate limit window expires
```

### 5.5 Database is Down

```
1. Consumer receives event
2. claimNotification → Prisma throws (connection error)
3. Error is BEFORE log creation → throw
4. KafkaJS catches error → redelivers message
5. On redelivery, if DB is back → claim succeeds → normal flow
6. If DB still down → throw again → KafkaJS retries with backoff
```

---

## 6. Observability

- **Structured JSON logs** via `@nexus/logger` (Winston) with `requestId` /
  `correlationId` / `traceId` propagation
- **W3C traceparent** propagated from Kafka message headers through the entire
  processing pipeline
- **NotificationLog status** (`PENDING` → `SENT` / `FAILED` / `DLQ`) provides a
  queryable audit trail
- **CircuitBreaker state** (`CLOSED` / `OPEN` / `HALF_OPEN`) logged on
  transitions for operational visibility
- **Slow query detection** — Prisma logs queries > 1000ms

---

## 7. Interview Talking Points

1. **"How do you ensure exactly-once delivery?"** → "You can't — it's impossible
   in distributed systems. We use at-least-once
   - idempotency to achieve effectively-once processing. The `eventId` unique
     constraint on `NotificationLog` makes duplicate inserts a no-op."

2. **"What happens if the email provider is down?"** → "The circuit breaker
   opens after 5 consecutive failures, fast-failing all requests. Retries use
   exponential backoff with full jitter. After 3 failed attempts, the
   notification is routed to the DLQ for manual re-drive."

3. **"How do you handle thundering herd?"** → "Full jitter backoff — each retry
   gets a random delay between 0 and the exponential cap. This spreads
   concurrent retries across the delay window."

4. **"How do you prevent email bombing?"** → "Redis sliding-window rate limiter
   per recipient (max 5/hour). Atomic Lua script ensures no race condition. Keys
   are SHA-256 hashed to avoid PII in Redis."

5. **"What's your clean architecture boundary?"** → "The NotificationService
   depends on interfaces (EmailProvider, CircuitBreaker, RateLimiter) — never on
   Prisma, Kafka, or Resend directly. Infrastructure adapters
   (notification-log.ts, dlq.ts, kafka-consumer.ts) handle the concrete
   implementations. The composition root (container.ts) wires everything
   together."

6. **"Why not use Kafka transactions for exactly-once?"** → "Kafka transactions
   only work within the Kafka ecosystem. The moment you side-effect outside
   Kafka (send an email, write to Postgres), the transaction boundary breaks.
   The external system can't participate in Kafka's transaction coordinator."
