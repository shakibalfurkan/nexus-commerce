## Architecture Overview

Nexus is an event-driven multivendor e-commerce platform built as a Turborepo monorepo of Node/TypeScript microservices and three frontends.

### Services

| #   | Service              | Responsibility                                                   | Database                                          |
| --- | -------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| 1   | api-gateway          | Routing, CORS, request aggregation, internal-secret injection    | None (stateless)                                  |
| 2   | auth-service         | Login, JWT (access + rotating refresh), OTP, password reset      | Aiven Postgres `auth_db` + Redis (refresh tokens) |
| 3   | user-service         | Profiles, roles, admin operations, central dead-letter dashboard | Aiven Postgres `user_db`                          |
| 4   | notification-service | Email delivery (Resend), event consumer                          | Aiven Postgres `notification_db`                  |
| 5   | shop-service         | Seller store profile, verification, store settings               | CockroachDB Serverless                            |
| 6   | product-service      | Catalog and reviews                                              | MongoDB Atlas                                     |
| 7   | order-service        | Orders, cart (Redis), inventory                                  | CockroachDB Serverless                            |
| 8   | payment-service      | Payments, immutable ledger                                       | CockroachDB Serverless                            |

### Frontends

| App              | Stack               | Audience                                 |
| ---------------- | ------------------- | ---------------------------------------- |
| customer-web     | Next.js (SSR-first) | Shoppers                                 |
| seller-dashboard | React               | Sellers                                  |
| admin-dashboard  | React               | Admins (users, dead letters, moderation) |

### Data Stores

| Store                                         | Provider       | Used for                                     |
| --------------------------------------------- | -------------- | -------------------------------------------- |
| PostgreSQL (one instance, separate databases) | Aiven          | auth_db, user_db, notification_db            |
| CockroachDB Serverless                        | Cockroach Labs | shop, order, payment                         |
| MongoDB                                       | Atlas M0       | product catalog, reviews                     |
| Redis                                         | Upstash        | Refresh tokens, rate limiting, cart, caching |
| Kafka                                         | Aiven          | `domain-events`, `dead-letter-queue` topics  |

### Key Patterns

- **Database per service**: no cross-service DB reads; API calls or Kafka events only.
- **Transactional outbox**: every event is written in the same transaction as the business change, then published by a shared 5s interval poller (`packages/kafka`).
- **Dead-letter handling**: failed events from any service flow to one `dead-letter-queue` topic and are stored centrally in user-service for admin review and manual redrive.
- **Auth**: short-lived access JWT, refresh tokens stored hashed in Redis with rotation and reuse detection.
- **Gateway trust**: downstream services accept requests only with the internal secret header.

### Repository Structure

```
nexus-commerce/
├── apps/
│   ├── customer-web/
│   ├── seller-dashboard/
│   └── admin-dashboard/
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── notification-service/
│   ├── shop-service/
│   ├── product-service/
│   ├── order-service/
│   └── payment-service/
├── packages/
│   ├── kafka/            # EventBus, OutboxPoller, dead-letter helper
│   ├── event-contracts/  # Event schemas, topic names
│   ├── logger/
│   ├── redis/
│   ├── errors/
│   ├── config/
│   └── ui/               # shared shadcn/ui components
├── docs/adr/             # architecture decision records
├── AGENTS.md
└── turbo.json
```

### Service Layout (convention)

```
src/
├── config/        # plain env-derived settings
├── lib/           # live clients (prisma, redis, kafka)
├── repositories/  # entity-specific data access
├── services/      # business logic
├── events/        # eventBus, outbox wiring, consumers
├── modules/       # routes, controllers, validation
└── utils/         # generic helpers
```
