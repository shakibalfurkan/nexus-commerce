# 🛒 Multi-Vendor E-Commerce Microservices Platform

> A production-ready, event-driven microservices architecture built with
> Node.js, TypeScript, React, Next.js, and modern cloud technologies.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://ecommerce-customer.vercel.app)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

**🔗 Live Applications:**

- [Customer Storefront →](https://ecommerce-customer.vercel.app)
- [Vendor Dashboard →](https://ecommerce-vendor.vercel.app)
- [Admin Panel →](https://ecommerce-admin.vercel.app)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Microservices](#microservices)
- [Features](#features)
- [System Design](#system-design)
- [Getting Started](#getting-started)
- [Screenshots](#screenshots)

---

## 🎯 Overview

A scalable, multi-tenant e-commerce platform where vendors can list products,
customers can purchase items, and administrators manage the entire ecosystem.
Built using microservices architecture to demonstrate enterprise-level design
patterns.

**Key Highlights:**

- 🏗️ **10 microservices** with independent deployment & scaling
- 🗄️ **Database per service** pattern (8 databases across Postgres & MongoDB)
- 📡 **Event-driven** architecture using Kafka/Redis Pub-Sub
- 🔐 **Centralized authentication** with JWT & RBAC
- 🐳 **Containerized** with Docker
- ☁️ **Cloud-deployed** across Vercel, Render, Railway

---

## 🏗️ Architecture

### High-Level System Design

![System Architecture](./diagrams/system-architecture.png)

### Service Communication Pattern

![Service Communication](./diagrams/service-communication.png)

---

## 🛠️ Technologies

### Frontend

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-3-cyan)

### Backend

![Node.js](https://img.shields.io/badge/Node.js-20-green)
![Express](https://img.shields.io/badge/Express-4-lightgrey)
![GraphQL](https://img.shields.io/badge/GraphQL-Apollo-purple)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

### Databases

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green)
![Redis](https://img.shields.io/badge/Redis-7-red)

### Infrastructure

![Docker](https://img.shields.io/badge/Docker-latest-blue)
![Kafka](https://img.shields.io/badge/Kafka-3-black)
![GitHub Actions](https://img.shields.io/badge/CI/CD-GitHub_Actions-blue)

---

## 🎡 Microservices

### Frontend Applications

| Service              | Repository                                                       | Tech Stack                        | Deployment |
| -------------------- | ---------------------------------------------------------------- | --------------------------------- | ---------- |
| **Customer Web**     | [→ Repo](https://github.com/yourname/ecommerce-customer-web)     | Next.js 14, TypeScript, Tailwind  | Vercel     |
| **Vendor Dashboard** | [→ Repo](https://github.com/yourname/ecommerce-vendor-dashboard) | React 18, TypeScript, Ant Design  | Vercel     |
| **Admin Panel**      | [→ Repo](https://github.com/yourname/ecommerce-admin-panel)      | React 18, TypeScript, Material UI | Vercel     |

### Backend Services

| Service                  | Repository                                                           | Database        | Port | Deployment |
| ------------------------ | -------------------------------------------------------------------- | --------------- | ---- | ---------- |
| **API Gateway**          | [→ Repo](https://github.com/yourname/ecommerce-api-gateway)          | -               | 4000 | Render     |
| **Auth Service**         | [→ Repo](https://github.com/yourname/ecommerce-auth-service)         | Postgres (Neon) | 4001 | Render     |
| **User Service**         | [→ Repo](https://github.com/yourname/ecommerce-user-service)         | Postgres (Neon) | 4002 | Render     |
| **Product Service**      | [→ Repo](https://github.com/yourname/ecommerce-product-service)      | MongoDB Atlas   | 4003 | Railway    |
| **Order Service**        | [→ Repo](https://github.com/yourname/ecommerce-order-service)        | Postgres (Neon) | 4004 | Render     |
| **Payment Service**      | [→ Repo](https://github.com/yourname/ecommerce-payment-service)      | Postgres (Neon) | 4005 | Render     |
| **Notification Service** | [→ Repo](https://github.com/yourname/ecommerce-notification-service) | MongoDB Atlas   | 4006 | Render     |

---

## ✨ Features

### 👥 Customer Features

- ✅ Browse products with advanced search & filters
- ✅ Add to cart with real-time inventory validation
- ✅ Secure checkout with Stripe payment
- ✅ Order tracking & history
- ✅ Product reviews & ratings
- ✅ Wishlist management

### 🏪 Vendor Features

- ✅ Product catalog management
- ✅ Inventory tracking & alerts
- ✅ Order fulfillment dashboard
- ✅ Sales analytics & reporting
- ✅ Revenue & payout tracking
- ✅ Vendor verification system

### 🔧 Admin Features

- ✅ Vendor approval workflow
- ✅ Platform-wide analytics
- ✅ User & content moderation
- ✅ Commission configuration
- ✅ System health monitoring
- ✅ Promotional campaigns

---

## 🧩 System Design Highlights

### 1️⃣ Database Per Service Pattern

Each microservice owns its database for loose coupling:

```
auth-service    → auth_db (Postgres)
user-service    → user_db (Postgres)
product-service → products_db (MongoDB)
order-service   → order_db (Postgres)
...
```

### 2️⃣ Event-Driven Architecture

Services communicate asynchronously via Kafka:

```
order-service publishes → "order.created"
  ↓
payment-service subscribes → processes payment
notification-service subscribes → sends email
analytics-service subscribes → updates metrics
```

### 3️⃣ API Gateway Pattern

Single entry point for all client requests:

```
Customer App → API Gateway → routes to appropriate service
Vendor App   → API Gateway → JWT validation → service routing
Admin Panel  → API Gateway → RBAC check → service routing
```

### 4️⃣ Authentication Strategy

Centralized auth with distributed authorization:

```
1. auth-service: Issues JWT tokens
2. Each service: Validates JWT independently
3. Services check roles/permissions for their resources
```

### 5️⃣ Resilience Patterns

- Circuit breaker for service failures
- Retry logic with exponential backoff
- Request timeout handling
- Health check endpoints

---

## 🗄️ Database Design

![Database Schema](./diagrams/database-schema.png)

**PostgreSQL Databases (Neon.tech):**

- `auth_db` - User credentials, sessions
- `user_db` - User profiles, vendor profiles
- `order_db` - Orders, order items
- `payment_db` - Transactions, refunds

**MongoDB Databases (Atlas):**

- `products_db` - Product catalog, categories
- `notifications_db` - Notification queue, logs

**Redis (Upstash):**

- Session storage
- API response caching
- Rate limiting

[View detailed schema →](./docs/DATABASE_DESIGN.md)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL client (optional)
- MongoDB Compass (optional)

### Quick Start (Local Development)

```bash
# Clone the repositories
git clone https://github.com/yourname/ecommerce-customer-web
git clone https://github.com/yourname/ecommerce-api-gateway
git clone https://github.com/yourname/ecommerce-auth-service
# ... clone other services

# Run with Docker Compose (easiest)
cd ecommerce-microservices-platform/docker
docker-compose up

# Or run services individually
cd ecommerce-auth-service
npm install
cp .env.example .env
npm run dev
```

[Full development setup guide →](./docs/DEVELOPMENT.md)

---

## 📸 Screenshots

### Customer Storefront

<div align="center">
  <img src="./screenshots/customer-homepage.png" width="45%" />
  <img src="./screenshots/product-page.png" width="45%" />
</div>

### Vendor Dashboard

<div align="center">
  <img src="./screenshots/vendor-dashboard.png" width="45%" />
  <img src="./screenshots/vendor-analytics.png" width="45%" />
</div>

### Admin Panel

<div align="center">
  <img src="./screenshots/admin-dashboard.png" width="90%" />
</div>

---

## 📚 Documentation

- [System Architecture](./docs/ARCHITECTURE.md) - Detailed design decisions
- [API Documentation](./docs/API_DOCUMENTATION.md) - REST & GraphQL APIs
- [Database Design](./docs/DATABASE_DESIGN.md) - Schema & relationships
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment
- [Development Guide](./docs/DEVELOPMENT.md) - Local setup

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

---

## 📊 Performance Metrics

- ⚡ Average API response time: < 200ms
- 🚀 Page load time (LCP): < 2.5s
- 📈 Lighthouse score: 95+
- 🔄 Uptime: 99.9%

---

## 🔒 Security

- ✅ JWT authentication with refresh tokens
- ✅ Role-based access control (RBAC)
- ✅ Input validation & sanitization
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS protection
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Security headers (Helmet.js)

---

## 🎯 Learning Outcomes

Building this project taught me:

- Microservices architecture patterns
- Event-driven system design
- Database design & optimization
- DevOps & containerization
- Cloud deployment strategies
- API design (REST & GraphQL)
- Authentication & authorization
- Payment gateway integration

---

## 🤝 Contributing

This is a portfolio project, but feedback is welcome! Feel free to:

- Open issues for bugs or suggestions
- Submit PRs for improvements
- Star ⭐ the repo if you find it helpful

---

## 📧 Contact

**Your Name**

- 🌐 Portfolio: [yourwebsite.com](https://yourwebsite.com)
- 💼 LinkedIn: [linkedin.com/in/yourname](https://linkedin.com/in/yourname)
- 📧 Email: your.email@example.com
- 🐙 GitHub: [@yourname](https://github.com/yourname)

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details

---

<div align="center">
  <strong>⭐ If you found this helpful, please star the repository!</strong>
</div>
