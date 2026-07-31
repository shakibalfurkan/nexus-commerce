# Notification Service

Email notification delivery microservice for the Nexus Commerce platform.

## Responsibilities

- Send transactional emails (welcome emails, OTP codes, password resets)
- Email template rendering via EJS
- Kafka consumer for notification events
- Retry logic with dead-letter queue for failed deliveries
- Notification logging and status tracking

## Tech Stack

- **Runtime:** Node.js 24, TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL via Prisma ORM
- **Templates:** EJS
- **Email:** Nodemailer
- **Messaging:** Kafka (event-driven notifications)

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable       | Description                  |
| -------------- | ---------------------------- |
| `KAFKA_BROKER` | Kafka broker address         |
| `SMTP_HOST`    | SMTP server host             |
| `SMTP_PORT`    | SMTP server port             |
| `SMTP_USER`    | SMTP authentication username |
| `SMTP_PASS`    | SMTP authentication password |
| `DATABASE_URL` | PostgreSQL connection string |

Full list available in `.env.example`.

## Development

```bash
# From monorepo root
pnpm dev --filter=notification-service
```

## Prisma

Generate Prisma client after schema changes:

```bash
pnpm --filter=notification-service exec prisma generate
```

Run migrations:

```bash
pnpm --filter=notification-service exec prisma migrate dev
```

## Events Consumed

| Event Type           | Description                     |
| -------------------- | ------------------------------- |
| `email.send_welcome` | Send welcome email to new users |
| `email.send_otp`     | Send OTP verification email     |
