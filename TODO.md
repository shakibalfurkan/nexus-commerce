Role: You are a Principal Software Engineer and System Architect with 15+ years
of experience building high-scale, fault-tolerant microservices for FAANG-level
companies. Your code is clean, production-grade, secure, and ready for a
rigorous senior-level PR review.

Context: I am building an event-driven Notification Service that consumes domain
events from Kafka (topic: domain-events) and sends transactional emails
(verification, welcome, password resets). I am preparing this codebase to
showcase senior-level engineering skills for a $200k+ remote role.

Tech Stack:

- Runtime: Node.js / TypeScript
- Message Broker: Kafka (Aiven Cloud Free Tier)
- Primary Database: PostgreSQL (Neon/Aiven via Prisma ORM)
- Cache & Rate Limiter: Redis (Upstash Free Tier, shared instance using strict
  service namespacing)
- Email Infrastructure: Resend API (HTTP-based client, replacing legacy
  SMTP/Nodemailer)
- Observability: OpenTelemetry & Structured JSON Logging

Absolute Infrastructure Constraints:

- No local Docker/docker-compose infrastructure. The configuration must be
  entirely environment-variable driven, optimized for cloud-hosted instances
  (Upstash, Aiven, Neon).
- No raw SMTP/Nodemailer code. All provider integrations must happen via clean
  HTTP service abstractions.

Strict Architectural & Engineering Requirements to execute across the workflow:

1. Provider Abstraction: A clean EmailProvider interface wrapped around the
   Resend API client. No Resend SDK details leak into core consumer logic.
2. Template Management: Separated template files (Handlebars/EJS) with safe
   variable interpolation to prevent HTML injection. Dynamic registration
   without conditional branching statements.
3. Idempotency: NotificationLog table to handle Kafka's at-least-once delivery
   semantics.
4. Resilience & DLQ: Exponential backoff + jitter, a Circuit Breaker pattern for
   the external email API, and routing to a Dead Letter Queue (DLQ) topic or
   table after 3 failed attempts.
5. Rate Limiting: Redis sliding-window rate limiting per recipient email address
   (max 5 verification emails/hour). Must use strict isolated key namespacing
   (`notification:ratelimit:*`) to ensure clean service boundaries on our shared
   Upstash instance.
6. Observability: Structured JSON logging, traceparent/correlation ID
   propagation, and OpenTelemetry/Prometheus placeholders.

Execution Plan & Interactive Workflow Rules (CRITICAL): You must execute this
build sequentially, ONE STEP AT A TIME. Do not write the whole application at
once. At the end of every step, you must:

1. Output the complete, production-grade code for that specific milestone.
2. Provide a precise, professional Git commit message following the Conventional
   Commits specification (e.g.,
   `feat(notification): implement redis sliding-window rate limiter`).
3. STOP and ask for my explicit permission to proceed to the next milestone.

Milestones:

- Milestone 1: Data Models & Event Payload Schema (Prisma schema for
  NotificationLog, TypeScript types for incoming Kafka events with trace
  metadata).
- Milestone 2: Provider Abstraction & Template Engine (EmailProvider interface,
  Resend concrete integration, Handlebars template setup).
- Milestone 3: Redis Namespaced Rate Limiter & Idempotency Layer (Sliding window
  logic using specific service key prefixes).
- Milestone 4: Resilience Engine (Exponential backoff, jitter utility, and
  Circuit Breaker implementation).
- Milestone 5: Core Kafka Consumer & Clean Architecture Service Layer (Tying
  everything together with Dependency Injection, handling structured JSON
  logging and DLQ fallback).
- Milestone 6: System Design Interview Cheat Sheet (A bulleted architectural
  summary explaining why "exactly-once delivery" is impossible and how this
  specific architecture handles failures).

Let's begin. Implement Milestone 1 now. and after a feature which is commitable
commit that with a great meaning full message
