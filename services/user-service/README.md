# User Service

User profile management microservice for the Nexus Commerce platform.

## Responsibilities

- User profile CRUD (customer, seller, admin profiles)
- Profile provisioning in response to auth-service events
- User lifecycle management (soft/hard delete, restore)
- Account status management (block/unblock)
- Role management
- Event-driven synchronization with auth-service

## Tech Stack

- **Runtime:** Node.js 24, TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL via Prisma ORM
- **Cache:** Redis (Upstash)
- **Messaging:** Kafka (event-driven profile sync)
- **Validation:** Zod

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable                   | Description                      |
| -------------------------- | -------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string     |
| `REDIS_DATABASE_URL`       | Redis connection string          |
| `JWT_ACCESS_TOKEN_SECRET`  | Secret for access tokens         |
| `JWT_REFRESH_TOKEN_SECRET` | Secret for refresh tokens        |
| `JWT_RESET_TOKEN_SECRET`   | Secret for password reset tokens |
| `KAFKA_BROKER`             | Kafka broker address             |

Full list available in `.env.example`.

## Development

```bash
# From monorepo root
pnpm dev --filter=user-service
```

## Prisma

Generate Prisma client after schema changes:

```bash
pnpm --filter=user-service exec prisma generate
```

Run migrations:

```bash
pnpm --filter=user-service exec prisma migrate dev
```

## API Endpoints

| Method | Path                 | Description               |
| ------ | -------------------- | ------------------------- |
| GET    | `/users/:id`         | Get user by ID            |
| PATCH  | `/users/:id`         | Update user profile       |
| DELETE | `/users/:id`         | Soft-delete user          |
| POST   | `/users/:id/restore` | Restore soft-deleted user |
| POST   | `/users/:id/block`   | Block user                |
| POST   | `/users/:id/unblock` | Unblock user              |
| GET    | `/users`             | List users (paginated)    |
