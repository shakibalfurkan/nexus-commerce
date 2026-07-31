# API Gateway

Single entry point for all Nexus Commerce client requests.

## Responsibilities

- Route incoming requests to appropriate microservices
- JWT validation and authentication enforcement
- Rate limiting (per-IP, per-endpoint)
- Request/response transformation
- Circuit breaker for downstream service resilience
- Request ID generation and tracing
- Security headers (Helmet)
- CORS configuration

## Tech Stack

- **Runtime:** Node.js 24, TypeScript
- **Framework:** Express 5
- **Proxy:** http-proxy-middleware
- **Cache:** Redis (rate limiting)
- **Logging:** Winston

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable                    | Description                   |
| --------------------------- | ----------------------------- |
| `AUTH_SERVICE_URL`          | Auth service internal URL     |
| `USER_SERVICE_URL`          | User service internal URL     |
| `PAYMENT_SERVICE_URL`       | Payment service internal URL  |
| `REDIS_URL`                 | Redis connection string       |
| `ALLOWED_ORIGINS`           | CORS allowed origins          |
| `CIRCUIT_BREAKER_THRESHOLD` | Failure threshold for breaker |

Full list available in `.env.example`.

## Development

```bash
# From monorepo root
pnpm dev --filter=api-gateway
```

## Docker

Build using Turbo Prune (recommended):

```bash
turbo prune --scope=api-gateway --docker
cd .out && docker build -t api-gateway .
```

See root-level Docker Compose for multi-service orchestration.

## API Endpoints

| Method | Path          | Description                |
| ------ | ------------- | -------------------------- |
| All    | `/auth/*`     | Proxied to auth-service    |
| All    | `/users/*`    | Proxied to user-service    |
| All    | `/products/*` | Proxied to product-service |
| All    | `/orders/*`   | Proxied to order-service   |
