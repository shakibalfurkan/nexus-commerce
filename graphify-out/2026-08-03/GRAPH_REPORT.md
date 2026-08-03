# Graph Report - nexus-commerce  (2026-08-03)

## Corpus Check
- 240 files · ~48,394 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1635 nodes · 2547 edges · 122 communities (112 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e4fe6729`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auditLog.repository.ts
- user.validation.ts
- web/package.json
- devDependencies
- @types/node
- compilerOptions
- api-gateway/src/app.ts
- devDependencies
- event-contracts/src/index.ts
- layout.tsx
- kafka/package.json
- compilerOptions
- auth.service.ts
- auth-service/src/events/eventTypes.ts
- container.ts
- errors/src/index.ts
- user-service/src/events/eventTypes.ts
- dependencies
- Nexus Notification Service — Build Context
- dependencies
- domain-event.schemas.ts
- notification-service.ts
- dependencies
- compilerOptions
- CircuitBreaker
- dependencies
- template-engine.ts
- compilerOptions
- user.service.ts
- user-service/src/lib/prisma.ts
- user.controller.ts
- compilerOptions
- compilerOptions
- devDependencies
- config/package.json
- logger/src/index.ts
- logger/package.json
- auth-service/package.json
- user.route.ts
- auth-service/src/lib/prisma.ts
- notification-service/package.json
- user-service/package.json
- compilerOptions
- api-gateway/package.json
- devDependencies
- event-contracts/package.json
- shared-types/package.json
- auth.controller.ts
- resend-email.provider.ts
- shared-utils/package.json
- errors/package.json
- auth-service/src/app.ts
- auth-service/src/events/outboxPoller.ts
- idempotency/idempotency.ts
- shippingAddress.repository.ts
- user-service/src/events/outboxPoller.ts
- devDependencies
- user.repository.ts
- include
- package.json
- user-service/src/app.ts
- @nexus/logger
- middlewares/circuitBreaker.ts
- customer.route.ts
- auth.validation.ts
- outboxEvent.repository.ts
- @repo/typescript-config/base.json
- auth-service/src/config/index.ts
- typescript
- redis/package.json
- notification-service/src/utils/logger.ts
- ui/tsconfig.json
- auth.route.ts
- customer.controller.ts
- next.js
- formatUptime
- rate-limiter.ts
- auth.interface.ts
- page.tsx
- config/tsconfig.json
- event-contracts/tsconfig.json
- kafka/tsconfig.json
- logger/tsconfig.json
- redis/tsconfig.json
- shared-types/tsconfig.json
- typescript-config/package.json
- devDependencies
- node_modules
- api-gateway/src/middlewares/globalErrorHandler.ts
- CircuitBreaker
- auth-service/src/utils/token/verifyToken.ts
- shopAddress.repository.ts
- scripts
- @nexus/shared-types
- devDependencies
- @nexus/errors
- scripts
- @nexus/event-contracts
- @nexus/config
- devDependencies
- auth-service/src/types/express.d.ts
- user-service/src/types/express.d.ts
- interfaces/express.d.ts
- notification-service/src/types/express.d.ts
- global.d.ts
- next.config.js
- @nexus/shared-utils
- devDependencies
- types/index.ts
- @types/cors
- @nexus/kafka
- lib
- types

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 21 edges
2. `compilerOptions` - 21 edges
3. `AppError` - 19 edges
4. `compilerOptions` - 19 edges
5. `compilerOptions` - 19 edges
6. `compilerOptions` - 18 edges
7. `typescript` - 16 edges
8. `createLogger()` - 15 edges
9. `compilerOptions` - 15 edges
10. `@types/node` - 14 edges

## Surprising Connections (you probably didn't know these)
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  services/notification-service/tsconfig.json → apps/web/tsconfig.json
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  services/user-service/tsconfig.json → apps/web/tsconfig.json
- `createApp()` --calls--> `createLogger()`  [EXTRACTED]
  services/api-gateway/src/app.ts → packages/logger/src/index.ts
- `createApp()` --calls--> `createLogger()`  [EXTRACTED]
  services/auth-service/src/app.ts → packages/logger/src/index.ts
- `createApp()` --calls--> `createLogger()`  [EXTRACTED]
  services/user-service/src/app.ts → packages/logger/src/index.ts

## Import Cycles
- None detected.

## Communities (122 total, 10 thin omitted)

### Community 0 - "auditLog.repository.ts"
Cohesion: 0.23
Nodes (13): CreateAuditLogData, ListAuditLogFilters, listByAction(), listByActor(), listByTarget(), listWithFilters(), listByProfileId(), listBySellerProfileId() (+5 more)

### Community 1 - "user.validation.ts"
Cohesion: 0.11
Nodes (17): adminPayloadSchema, avatarField, coordinatesSchema, createUserProfileValidation, customerPayloadSchema, dateOfBirthField, emailField, firstNameField (+9 more)

### Community 2 - "web/package.json"
Cohesion: 0.06
Nodes (32): dependencies, next, react, react-dom, @repo/ui, react, react-dom, name (+24 more)

### Community 3 - "devDependencies"
Cohesion: 0.17
Nodes (12): @types/morgan, @types/morgan, @types/cookie-parser, @types/morgan, @types/cookie-parser, devDependencies, @types/cookie-parser, @types/morgan (+4 more)

### Community 4 - "@types/node"
Cohesion: 0.12
Nodes (20): @repo/typescript-config, @repo/typescript-config, @types/node, devDependencies, @repo/typescript-config, @types/node, typescript, devDependencies (+12 more)

### Community 5 - "compilerOptions"
Cohesion: 0.07
Nodes (29): generated/*, baseUrl, compilerOptions, declaration, declarationMap, exactOptionalPropertyTypes, isolatedModules, jsx (+21 more)

### Community 6 - "api-gateway/src/app.ts"
Cohesion: 0.17
Nodes (15): createApp(), config, redisClient, corsMiddleware, globalErrorHandler(), notFoundHandler(), buildProxy(), registerProxies() (+7 more)

### Community 7 - "devDependencies"
Cohesion: 0.07
Nodes (28): eslint-config-prettier, @eslint/js, eslint-plugin-only-warn, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-turbo, globals, @next/eslint-plugin-next (+20 more)

### Community 8 - "event-contracts/src/index.ts"
Cohesion: 0.07
Nodes (27): CustomerProfileCreatedEvent, CustomerProfileCreatedEventSchema, CustomerProfileRequestedEvent, CustomerProfileRequestedEventSchema, DLQEventTypes, DomainEventSchema, DomainEventTypes, EmailVerificationOtpEvent (+19 more)

### Community 9 - "layout.tsx"
Cohesion: 0.07
Nodes (25): geistMono, geistSans, metadata, ^build, ^check-types, .env*, ^lint, .next/** (+17 more)

### Community 10 - "kafka/package.json"
Cohesion: 0.17
Nodes (11): author, description, exports, keywords, license, name, scripts, build (+3 more)

### Community 11 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, jsx (+19 more)

### Community 12 - "auth.service.ts"
Cohesion: 0.17
Nodes (26): createEventMetadata(), emitDomainEvent(), deriveRequiredRole(), isAdminRole(), login(), logout(), mapBodyRoleToUserRole(), provisionCustomer() (+18 more)

### Community 13 - "auth-service/src/events/eventTypes.ts"
Cohesion: 0.11
Nodes (25): BadRequestError, redisClient, CustomerProfileCreatedEvent, CustomerProfileCreatedSchema, CustomerProfileRequestedEvent, CustomerProfileRequestedSchema, DLQEventTypes, DomainEventSchema (+17 more)

### Community 14 - "container.ts"
Cohesion: 0.18
Nodes (11): createNotificationService(), isRetryableEmailError(), startNotificationPipeline(), startKafkaConsumer(), EmailProviderError, EmailProviderErrorOptions, createBackoffOptions(), CircuitBreakerOptions (+3 more)

### Community 15 - "errors/src/index.ts"
Cohesion: 0.10
Nodes (17): AppError, CircuitBreakerError, ConflictError, ForbiddenError, GatewayTimeoutError, InternalServerError, NotFoundError, ServiceUnavailableError (+9 more)

### Community 16 - "user-service/src/events/eventTypes.ts"
Cohesion: 0.10
Nodes (18): CommandTypes, DLQEventTypes, DomainEventSchema, NotificationEventSchema, SendOtpNotification, SendOtpNotificationSchema, TDomainEventType, TNotificationEventType (+10 more)

### Community 17 - "dependencies"
Cohesion: 0.09
Nodes (23): compression, express-rate-limit, hpp, http-proxy-middleware, rate-limit-redis, dependencies, compression, cors (+15 more)

### Community 18 - "Nexus Notification Service — Build Context"
Cohesion: 0.15
Nodes (12): All Milestones Complete ✅, Gotchas, Key Decisions, Milestone 1 — DONE (committed `1f5e307`), Milestone 2 — DONE (committed `841413e`), Milestone 3 — DONE (committed `47dd827`), Milestone 4 — DONE (committed `6910cfb`), Milestone 5 — DONE (committed `c986937`) (+4 more)

### Community 19 - "dependencies"
Cohesion: 0.08
Nodes (24): bcrypt, dependencies, axios, bcrypt, cookie-parser, cors, express, helmet (+16 more)

### Community 20 - "domain-event.schemas.ts"
Cohesion: 0.09
Nodes (23): DomainEventNames, DomainEventNameSchema, domainEventRegistry, DomainEventSchema, EmailVerificationOtpEvent, EmailVerificationOtpEventSchema, EventEnvelopeMetadataSchema, getEventRegistryEntry() (+15 more)

### Community 21 - "notification-service.ts"
Cohesion: 0.25
Nodes (10): BackoffOptions, calculateBackoff(), retryWithBackoff(), sleep(), routeToDlq(), markAsFailed(), markAsSent(), isRetryableEmailError() (+2 more)

### Community 22 - "dependencies"
Cohesion: 0.09
Nodes (22): react-email, @react-email/render, @nexus/redis, @nexus/redis, @nexus/redis, dependencies, express, helmet (+14 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, declaration, declarationMap, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module (+13 more)

### Community 25 - "dependencies"
Cohesion: 0.08
Nodes (24): jsonwebtoken, @prisma/client, jsonwebtoken, @prisma/client, @prisma/client, dependencies, axios, cors (+16 more)

### Community 26 - "template-engine.ts"
Cohesion: 0.12
Nodes (16): EmailLayout(), EmailLayoutProps, emailStyles, EmailVerificationEmail(), EmailVerificationEmailProps, PasswordResetEmail(), PasswordResetEmailProps, isTemplateKey() (+8 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, incremental, isolatedModules, lib, module (+11 more)

### Community 28 - "user.service.ts"
Cohesion: 0.15
Nodes (11): DomainEventTypes, NotificationTypes, TDomainEvent, TNotificationEvent, emitDomainEvent(), emitNotificationEvent(), eventTopicMap, writeOutboxEvent() (+3 more)

### Community 29 - "user-service/src/lib/prisma.ts"
Cohesion: 0.12
Nodes (6): adapter, POOL_CONFIG, prisma, UpdateAdminProfileData, UpdateCustomerProfileData, UpdateSellerProfileData

### Community 30 - "user.controller.ts"
Cohesion: 0.22
Nodes (8): createUserProfile, deleteUser, getUserByEmail, getUserById, hardDeleteUser, restoreUser, CreateUserProfileDTO, UserService

### Community 31 - "compilerOptions"
Cohesion: 0.11
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, jsx (+11 more)

### Community 32 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, declaration, declarationMap, exactOptionalPropertyTypes, isolatedModules, jsx, module, moduleDetection (+10 more)

### Community 33 - "devDependencies"
Cohesion: 0.25
Nodes (8): @repo/eslint-config, @repo/eslint-config, devDependencies, @repo/eslint-config, @repo/typescript-config, @types/node, typescript, @repo/eslint-config

### Community 34 - "config/package.json"
Cohesion: 0.12
Nodes (16): dotenv, author, dependencies, dotenv, zod, description, exports, zod (+8 more)

### Community 35 - "logger/src/index.ts"
Cohesion: 0.13
Nodes (13): createKafkaClient(), EventBus, KafkaClientOptions, PublishOptions, consoleFormat, createLogger(), fileFormat, Logger (+5 more)

### Community 36 - "logger/package.json"
Cohesion: 0.12
Nodes (16): author, dependencies, winston, winston-daily-rotate-file, description, exports, keywords, license (+8 more)

### Community 37 - "auth-service/package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, packageManager, type (+1 more)

### Community 38 - "user.route.ts"
Cohesion: 0.24
Nodes (7): parseBody, validateRequest(), verifyInternalCall(), UserController, router, UserValidation, catchAsync()

### Community 39 - "auth-service/src/lib/prisma.ts"
Cohesion: 0.12
Nodes (3): adapter, POOL_CONFIG, prisma

### Community 40 - "notification-service/package.json"
Cohesion: 0.12
Nodes (16): author, description, keywords, license, main, name, packageManager, scripts (+8 more)

### Community 41 - "user-service/package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, packageManager, type (+1 more)

### Community 42 - "compilerOptions"
Cohesion: 0.12
Nodes (14): compilerOptions, allowJs, jsx, module, moduleResolution, noEmit, plugins, extends (+6 more)

### Community 43 - "api-gateway/package.json"
Cohesion: 0.12
Nodes (15): author, description, keywords, license, main, name, packageManager, scripts (+7 more)

### Community 44 - "devDependencies"
Cohesion: 0.11
Nodes (20): devDependencies, eslint, @types/node, @types/react, @types/react-dom, typescript, eslint, @types/react (+12 more)

### Community 45 - "event-contracts/package.json"
Cohesion: 0.13
Nodes (14): author, dependencies, zod, description, exports, zod, keywords, license (+6 more)

### Community 46 - "shared-types/package.json"
Cohesion: 0.13
Nodes (14): author, dependencies, zod, description, exports, zod, keywords, license (+6 more)

### Community 47 - "auth.controller.ts"
Cohesion: 0.15
Nodes (13): login, logout, provisionCustomer, provisionSeller, refreshToken, registerRequest, requestPasswordReset, resendOtp (+5 more)

### Community 48 - "resend-email.provider.ts"
Cohesion: 0.22
Nodes (8): EmailProvider, SendEmailCommand, SendEmailResult, ResendEmailProvider, ResendEmailProviderOptions, ResendErrorResponse, ResendSuccessResponse, logger

### Community 49 - "shared-utils/package.json"
Cohesion: 0.14
Nodes (13): author, dependencies, description, exports, keywords, license, name, scripts (+5 more)

### Community 50 - "errors/package.json"
Cohesion: 0.15
Nodes (12): author, dependencies, description, exports, keywords, license, name, scripts (+4 more)

### Community 51 - "auth-service/src/app.ts"
Cohesion: 0.27
Nodes (9): createApp(), globalErrorHandler(), notFoundHandler(), requestIdMiddleware(), DANGEROUS_PATTERNS, escapeHtml(), sanitizationMiddleware(), sanitizeValue() (+1 more)

### Community 52 - "auth-service/src/events/outboxPoller.ts"
Cohesion: 0.17
Nodes (13): TDomainEvent, calculateBackoff(), DEFAULT_OPTIONS, effectiveOptions, handleFailure(), OutboxPollerOptions, processNextBatch(), publishDeadLetterEvent() (+5 more)

### Community 53 - "idempotency/idempotency.ts"
Cohesion: 0.33
Nodes (6): TNotificationType, claimNotification(), ClaimNotificationInput, IdempotencyResult, isUniqueConstraintViolation(), prisma

### Community 54 - "shippingAddress.repository.ts"
Cohesion: 0.17
Nodes (5): CreateShippingAddressData, UpdateShippingAddressData, CURSOR_ENCODING, CursorPaginationParams, CursorPaginationResult

### Community 55 - "user-service/src/events/outboxPoller.ts"
Cohesion: 0.05
Nodes (34): corsSchema, jwtSchema, kafkaSchema, nodeEnvSchema, optionalEnv(), requireEnv(), CircuitBreaker, CircuitBreakerOptions (+26 more)

### Community 56 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, tsx, @types/bcrypt, @types/jsonwebtoken, @types/pg, typescript, tsx, @types/jsonwebtoken (+5 more)

### Community 57 - "user.repository.ts"
Cohesion: 0.05
Nodes (39): negativeCacheKey(), SERVICE_PREFIX, TTL, userEmailKey(), userProfileKey(), cacheGet(), CacheGetOptions, cacheInvalidate() (+31 more)

### Community 58 - "include"
Cohesion: 0.17
Nodes (11): compilerOptions, plugins, strictNullChecks, extends, include, next.config.js, next-env.d.ts, .next/types/**/*.ts (+3 more)

### Community 59 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, private, scripts, build, check-types (+3 more)

### Community 60 - "user-service/src/app.ts"
Cohesion: 0.21
Nodes (11): createMorganStream(), createApp(), notFoundHandler(), requestIdMiddleware(), DANGEROUS_PATTERNS, escapeHtml(), sanitizationMiddleware(), sanitizeValue() (+3 more)

### Community 61 - "@nexus/logger"
Cohesion: 0.18
Nodes (11): kafkajs, dependencies, kafkajs, @nexus/logger, uuid, @nexus/logger, uuid, @nexus/logger (+3 more)

### Community 62 - "middlewares/circuitBreaker.ts"
Cohesion: 0.33
Nodes (9): circuitBreakerMiddleware(), CircuitBreakerState, getOrCreate(), getState(), isOpen(), recordFailure(), recordSuccess(), refreshState() (+1 more)

### Community 63 - "customer.route.ts"
Cohesion: 0.23
Nodes (8): rateLimiter(), validateRequest(), router, CustomerRegisterRequestSchema, CustomerValidation, emailSchema, passwordSchema, catchAsync()

### Community 64 - "auth.validation.ts"
Cohesion: 0.18
Nodes (10): emailSchema, loginValidationSchema, passwordSchema, provisionCustomerValidationSchema, provisionSellerValidationSchema, registerRequestValidationSchema, requestPasswordResetValidationSchema, resendOtpValidationSchema (+2 more)

### Community 65 - "outboxEvent.repository.ts"
Cohesion: 0.18
Nodes (5): CreateOutboxEventData, listByStatus(), listDeadEvents(), OutboxEventRecord, OutboxStatus

### Community 66 - "@repo/typescript-config/base.json"
Cohesion: 0.20
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src, @repo/typescript-config/base.json, extends

### Community 67 - "auth-service/src/config/index.ts"
Cohesion: 0.13
Nodes (20): CircuitBreakerOptions, CircuitState, CircuitStateInternal, DEFAULT_OPTIONS, config, KafkaTopics, EventBus, DomainEventTypes (+12 more)

### Community 69 - "typescript"
Cohesion: 0.18
Nodes (11): devDependencies, prettier, turbo, typescript, turbo, typescript, devDependencies, @repo/typescript-config (+3 more)

### Community 70 - "redis/package.json"
Cohesion: 0.12
Nodes (15): ioredis, author, dependencies, ioredis, @nexus/logger, description, exports, keywords (+7 more)

### Community 71 - "notification-service/src/utils/logger.ts"
Cohesion: 0.21
Nodes (12): loadEnv(), disconnectKafkaProducer(), KafkaTopics, disconnectKafkaConsumer(), adapter, disconnectPrisma(), POOL_CONFIG, disconnectRedis() (+4 more)

### Community 72 - "ui/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, strictNullChecks, extends, include, src, @repo/typescript-config/react-library.json

### Community 73 - "auth.route.ts"
Cohesion: 0.25
Nodes (7): AuthController, AuthRoutes, router, AuthValidation, CustomerRoutes, globalRouter, moduleRoutes

### Community 74 - "customer.controller.ts"
Cohesion: 0.28
Nodes (6): CustomerController, CustomerRegisterRequest, ICustomerRegisterRequestDTO, CustomerService, sendResponse(), TResponse

### Community 75 - "next.js"
Cohesion: 0.39
Nodes (3): config, nextJsConfig, config

### Community 76 - "formatUptime"
Cohesion: 0.46
Nodes (4): formatUptime(), createApp(), globalErrorHandler(), notFoundHandler()

### Community 77 - "rate-limiter.ts"
Cohesion: 0.24
Nodes (6): buildRateLimitKey(), createRateLimiter(), hashRecipient(), RateLimitResult, SlidingWindowRateLimiter, SlidingWindowRateLimiterOptions

### Community 78 - "auth.interface.ts"
Cohesion: 0.25
Nodes (7): IAuthResult, ILoginDTO, IRegisterRequestDTO, IResendOtpDTO, ITokenRefreshResult, IVerifyRegistrationDTO, TRegisterRequest

### Community 79 - "page.tsx"
Cohesion: 0.33
Nodes (3): Props, Button(), ButtonProps

### Community 80 - "config/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, src

### Community 81 - "event-contracts/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, src

### Community 82 - "kafka/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, src

### Community 83 - "logger/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, src

### Community 84 - "redis/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, src

### Community 85 - "shared-types/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, src

### Community 86 - "typescript-config/package.json"
Cohesion: 0.29
Nodes (6): license, name, private, publishConfig, access, version

### Community 87 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, @types/compression, @types/hpp, @types/node, typescript, @types/compression, @types/hpp

### Community 88 - "node_modules"
Cohesion: 0.22
Nodes (8): exclude, node_modules, exclude, dist, exclude, include, dist, src/**/*

### Community 89 - "api-gateway/src/middlewares/globalErrorHandler.ts"
Cohesion: 0.44
Nodes (5): handleZodError(), TErrorResponse, TErrorSource, TSimplifiedError, globalErrorHandler()

### Community 91 - "auth-service/src/utils/token/verifyToken.ts"
Cohesion: 0.52
Nodes (4): authenticate(), ITokenPayload, IDecodedToken, verifyToken()

### Community 93 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, postinstall, start, test, watch

### Community 94 - "@nexus/shared-types"
Cohesion: 0.40
Nodes (5): @nexus/shared-types, @nexus/shared-types, @nexus/shared-types, @nexus/shared-types, @nexus/shared-types

### Community 95 - "devDependencies"
Cohesion: 0.17
Nodes (12): @types/express, @types/express, prisma, @types/express, prisma, devDependencies, prisma, @types/express (+4 more)

### Community 96 - "@nexus/errors"
Cohesion: 0.40
Nodes (5): @nexus/errors, @nexus/errors, @nexus/errors, @nexus/errors, @nexus/errors

### Community 97 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, postinstall, start, test, watch

### Community 98 - "@nexus/event-contracts"
Cohesion: 0.50
Nodes (4): @nexus/event-contracts, @nexus/event-contracts, @nexus/event-contracts, @nexus/event-contracts

### Community 99 - "@nexus/config"
Cohesion: 0.40
Nodes (5): @nexus/config, @nexus/config, @nexus/config, @nexus/config, @nexus/config

### Community 100 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, @repo/typescript-config, @types/node, typescript

### Community 101 - "auth-service/src/types/express.d.ts"
Cohesion: 0.50
Nodes (3): Express, Request, TUser

### Community 102 - "user-service/src/types/express.d.ts"
Cohesion: 0.50
Nodes (3): Express, Request, TUser

### Community 109 - "@nexus/shared-utils"
Cohesion: 0.40
Nodes (5): @nexus/shared-utils, @nexus/shared-utils, @nexus/shared-utils, @nexus/shared-utils, @nexus/shared-utils

### Community 110 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, @repo/typescript-config, @types/node, typescript

### Community 118 - "@types/cors"
Cohesion: 0.50
Nodes (4): @types/cors, @types/cors, @types/cors, @types/cors

### Community 119 - "@nexus/kafka"
Cohesion: 0.50
Nodes (4): @nexus/kafka, @nexus/kafka, @nexus/kafka, @nexus/kafka

## Knowledge Gaps
- **686 isolated node(s):** `CircuitBreakerState`, `CircuitBreakerOptions`, `ProcessEventResult`, `Project`, `Stack` (+681 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `typescript` connect `typescript` to `devDependencies`, `devDependencies`, `devDependencies`, `@types/node`, `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `@types/node` connect `@types/node` to `devDependencies`, `devDependencies`, `devDependencies`, `typescript`, `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `@nexus/errors`, `@nexus/event-contracts`, `@nexus/config`, `auth-service/package.json`, `@nexus/shared-utils`, `dependencies`, `dependencies`, `@nexus/kafka`, `dependencies`, `@nexus/logger`, `@nexus/shared-types`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `CircuitBreakerState`, `CircuitBreakerOptions`, `ProcessEventResult` to the rest of the system?**
  _686 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `user.validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `@types/node` be split into smaller, more focused modules?**
  _Cohesion score 0.11578947368421053 - nodes in this community are weakly interconnected._