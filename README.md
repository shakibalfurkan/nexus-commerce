# Nexus Commerce

A production-ready, event-driven multi-vendor e-commerce platform built with a
microservices architecture using Node.js, TypeScript, and modern cloud
technologies.

## Architecture

This monorepo (Turborepo) contains all backend microservices and shared
packages:

### Services

| Service                  | Description                                        | Tech                           |
| ------------------------ | -------------------------------------------------- | ------------------------------ |
| **API Gateway**          | Single entry point, request routing, rate limiting | Express 5, Redis               |
| **Auth Service**         | Authentication, JWT, RBAC, password management     | Express 5, Prisma (PostgreSQL) |
| **User Service**         | User profile CRUD, lifecycle management            | Express 5, Prisma (PostgreSQL) |
| **Notification Service** | Email delivery (welcome, OTP, password reset)      | Express 5, Nodemailer, EJS     |

### Shared Packages

| Package                      | Description                      |
| ---------------------------- | -------------------------------- |
| `packages/typescript-config` | Shared TypeScript configurations |
| `packages/eslint-config`     | Shared ESLint configurations     |
| `packages/shared-utils`      | Shared utility functions         |
| `packages/ui`                | Shared React UI components       |

## Prerequisites

- Node.js 18+
- pnpm 9+
- Docker & Docker Compose (for containerized development)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start all services in development mode
pnpm dev

# Or start a specific service
pnpm dev --filter=auth-service
```

## Development

Each service can be developed independently:

```bash
# Run a single service
pnpm dev --filter=user-service

# Build a single service
pnpm build --filter=api-gateway

# Lint all packages
pnpm lint

# Type-check all packages
pnpm check-types
```

## Docker

Build individual services using Turbo Prune:

```bash
turbo prune --scope=api-gateway --docker
cd .out && docker build -t api-gateway .
```

## Project Structure

```
nexus-commerce/
├── apps/                    # Frontend applications
│   └── web/                 # Next.js web app
├── packages/                # Shared packages
│   ├── eslint-config/       # ESLint configurations
│   ├── shared-utils/        # Utility functions
│   ├── typescript-config/   # TypeScript configurations
│   └── ui/                  # React component library
├── services/                # Backend microservices
│   ├── api-gateway/         # API Gateway
│   ├── auth-service/        # Authentication service
│   ├── notification-service/ # Notification service
│   └── user-service/        # User profile service
├── pnpm-workspace.yaml      # Workspace configuration
├── turbo.json               # Turborepo configuration
└── package.json             # Root package.json
```
