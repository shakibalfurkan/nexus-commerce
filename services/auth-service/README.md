# Auth Service

Authentication and authorization microservice for the Nexus Commerce platform.

## Responsibilities

- User registration with email/password
- JWT-based authentication (access + refresh tokens)
- Password reset flow
- Session management with refresh tokens
- Role-based access control (RBAC)
- Account lockout & security policies
- User provisioning events (seller/customer profile requests)
- Audit logging

## Tech Stack

- **Runtime:** Node.js 24, TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL via Prisma ORM
- **Cache:** Redis (Upstash)
- **Messaging:** Kafka (event-driven profile provisioning)
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
pnpm dev --filter=auth-service
```

## Prisma

Generate Prisma client after schema changes:

```bash
pnpm --filter=auth-service exec prisma generate
```

Run migrations:

```bash
pnpm --filter=auth-service exec prisma migrate dev
```

## API Endpoints

| Method | Path                       | Description                          |
| ------ | -------------------------- | ------------------------------------ |
| POST   | `/auth/register`           | Request registration (sends OTP)     |
| POST   | `/auth/verify-otp`         | Verify OTP and complete registration |
| POST   | `/auth/login`              | Authenticate user                    |
| POST   | `/auth/refresh`            | Refresh access token                 |
| POST   | `/auth/logout`             | Invalidate refresh token             |
| POST   | `/auth/forgot-password`    | Request password reset               |
| POST   | `/auth/reset-password`     | Reset password with token            |
| POST   | `/auth/provision/seller`   | Request seller profile creation      |
| POST   | `/auth/provision/customer` | Request customer profile creation    |
