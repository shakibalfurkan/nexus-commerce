# Graph Report - nexus-commerce  (2026-08-03)

## Corpus Check
- 240 files · ~48,036 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1619 nodes · 2546 edges · 118 communities (109 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6707f7cc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- outboxEvent.repository.ts
- user.validation.ts
- web/package.json
- devDependencies
- typescript
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
- cacheManager.ts
- dependencies
- domain-event.schemas.ts
- notification-service.ts
- dependencies
- compilerOptions
- user.repository.ts
- dependencies
- template-engine.ts
- compilerOptions
- user.service.ts
- user-service/src/lib/prisma.ts
- user.route.ts
- compilerOptions
- compilerOptions
- devDependencies
- config/package.json
- logger/src/index.ts
- logger/package.json
- auth-service/package.json
- customer.service.ts
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
- auth-service/src/lib/prisma.ts
- notification-service/src/lib/prisma.ts
- user-service/src/utils/logger.ts
- user-service/src/events/outboxPoller.ts
- middlewares/idempotency.ts
- user.dto.ts
- web/tsconfig.json
- package.json
- user-service/src/app.ts
- @nexus/logger
- middlewares/circuitBreaker.ts
- auth-service/src/middlewares/rateLimiter.ts
- auth.validation.ts
- config/src/index.ts
- @repo/typescript-config/base.json
- CircuitBreaker
- CircuitBreaker
- redis/package.json
- kafka-consumer.ts
- ui/tsconfig.json
- auth.route.ts
- customer.controller.ts
- next.js
- formatUptime
- userServiceClient.ts
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
- notification-service/tsconfig.json
- devDependencies
- CircuitBreaker
- user-service/src/server.ts
- user-service/src/events/outboxWriter.ts
- @nexus/redis
- @nexus/shared-types
- devDependencies
- morgan
- include
- @nexus/config
- auth-service/src/middlewares/validateRequest.ts
- auth-service/src/types/express.d.ts
- user-service/src/types/express.d.ts
- interfaces/express.d.ts
- notification-service/src/types/express.d.ts
- global.d.ts
- next.config.js
- @nexus/shared-utils
- types
- types/index.ts

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
  services/auth-service/tsconfig.json → apps/web/tsconfig.json
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  services/notification-service/tsconfig.json → apps/web/tsconfig.json
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  services/user-service/tsconfig.json → apps/web/tsconfig.json
- `createApp()` --calls--> `createLogger()`  [EXTRACTED]
  services/api-gateway/src/app.ts → packages/logger/src/index.ts
- `createApp()` --calls--> `createLogger()`  [EXTRACTED]
  services/auth-service/src/app.ts → packages/logger/src/index.ts

## Import Cycles
- None detected.

## Communities (118 total, 9 thin omitted)

### Community 0 - "outboxEvent.repository.ts"
Cohesion: 0.07
Nodes (25): CreateAuditLogData, ListAuditLogFilters, listByAction(), listByActor(), listByTarget(), listWithFilters(), CreateOutboxEventData, listByStatus() (+17 more)

### Community 1 - "user.validation.ts"
Cohesion: 0.11
Nodes (17): adminPayloadSchema, avatarField, coordinatesSchema, createUserProfileValidation, customerPayloadSchema, dateOfBirthField, emailField, firstNameField (+9 more)

### Community 2 - "web/package.json"
Cohesion: 0.06
Nodes (32): dependencies, next, react, react-dom, @repo/ui, react, react-dom, name (+24 more)

### Community 3 - "devDependencies"
Cohesion: 0.09
Nodes (26): @types/cors, @types/morgan, @types/cors, @types/morgan, devDependencies, tsx, @types/bcrypt, @types/cookie-parser (+18 more)

### Community 4 - "typescript"
Cohesion: 0.09
Nodes (31): @repo/typescript-config, @types/node, typescript, devDependencies, @repo/typescript-config, @types/node, typescript, devDependencies (+23 more)

### Community 5 - "compilerOptions"
Cohesion: 0.11
Nodes (19): compilerOptions, declaration, declarationMap, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "api-gateway/src/app.ts"
Cohesion: 0.18
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
Cohesion: 0.11
Nodes (17): kafkajs, author, dependencies, kafkajs, @nexus/logger, uuid, description, exports (+9 more)

### Community 11 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, jsx (+19 more)

### Community 12 - "auth.service.ts"
Cohesion: 0.17
Nodes (22): deriveRequiredRole(), isAdminRole(), login(), logout(), mapBodyRoleToUserRole(), refreshToken(), registerRequest(), verifyPasswordReset() (+14 more)

### Community 13 - "auth-service/src/events/eventTypes.ts"
Cohesion: 0.12
Nodes (16): CustomerProfileCreatedEvent, CustomerProfileCreatedSchema, CustomerProfileRequestedEvent, CustomerProfileRequestedSchema, DLQEventTypes, DomainEventSchema, DomainEventTypes, EmailVerificationOtpEvent (+8 more)

### Community 14 - "container.ts"
Cohesion: 0.19
Nodes (14): createNotificationService(), isRetryableEmailError(), startNotificationPipeline(), buildRateLimitKey(), createRateLimiter(), hashRecipient(), RateLimitResult, SlidingWindowRateLimiterOptions (+6 more)

### Community 15 - "errors/src/index.ts"
Cohesion: 0.09
Nodes (22): AppError, CircuitBreakerError, ConflictError, ForbiddenError, GatewayTimeoutError, InternalServerError, ServiceUnavailableError, TooManyRequestsError (+14 more)

### Community 16 - "user-service/src/events/eventTypes.ts"
Cohesion: 0.10
Nodes (18): CommandTypes, DLQEventTypes, DomainEventSchema, NotificationEventSchema, SendOtpNotification, SendOtpNotificationSchema, TDomainEventType, TNotificationEventType (+10 more)

### Community 17 - "dependencies"
Cohesion: 0.08
Nodes (24): compression, express-rate-limit, hpp, http-proxy-middleware, rate-limit-redis, dependencies, compression, cors (+16 more)

### Community 18 - "cacheManager.ts"
Cohesion: 0.11
Nodes (13): negativeCacheKey(), SERVICE_PREFIX, TTL, cacheGet(), CacheGetOptions, cacheInvalidate(), cacheInvalidateMany(), clearL1Cache() (+5 more)

### Community 19 - "dependencies"
Cohesion: 0.08
Nodes (24): bcrypt, dependencies, axios, bcrypt, cors, express, helmet, jsonwebtoken (+16 more)

### Community 20 - "domain-event.schemas.ts"
Cohesion: 0.11
Nodes (18): DomainEventNames, DomainEventNameSchema, domainEventRegistry, DomainEventSchema, EmailVerificationOtpEvent, EmailVerificationOtpEventSchema, EventEnvelopeMetadataSchema, NotificationType (+10 more)

### Community 21 - "notification-service.ts"
Cohesion: 0.20
Nodes (14): getEventRegistryEntry(), isHandledDomainEvent(), calculateBackoff(), retryWithBackoff(), sleep(), routeToDlq(), markAsFailed(), markAsSent() (+6 more)

### Community 22 - "dependencies"
Cohesion: 0.08
Nodes (25): react-email, @react-email/render, @nexus/event-contracts, @nexus/kafka, @nexus/event-contracts, @nexus/kafka, dependencies, express (+17 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, declaration, declarationMap, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module (+13 more)

### Community 24 - "user.repository.ts"
Cohesion: 0.13
Nodes (15): userEmailKey(), userProfileKey(), mapAdminProfile(), mapSellerProfile(), toUserResponseDTO(), activeUserFilter, computeDiff(), createUser() (+7 more)

### Community 25 - "dependencies"
Cohesion: 0.08
Nodes (24): cookie-parser, @prisma/adapter-pg, cookie-parser, @prisma/adapter-pg, @prisma/adapter-pg, dependencies, axios, cookie-parser (+16 more)

### Community 26 - "template-engine.ts"
Cohesion: 0.13
Nodes (14): EmailLayout(), EmailLayoutProps, emailStyles, EmailVerificationEmail(), EmailVerificationEmailProps, PasswordResetEmail(), PasswordResetEmailProps, RenderTemplateResult (+6 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, incremental, isolatedModules, lib, module (+11 more)

### Community 28 - "user.service.ts"
Cohesion: 0.12
Nodes (13): DomainEventTypes, NotificationTypes, emitDomainEvent(), createUserProfile, deleteUser, getUserByEmail, getUserById, hardDeleteUser (+5 more)

### Community 29 - "user-service/src/lib/prisma.ts"
Cohesion: 0.12
Nodes (6): adapter, POOL_CONFIG, prisma, UpdateAdminProfileData, UpdateCustomerProfileData, UpdateSellerProfileData

### Community 30 - "user.route.ts"
Cohesion: 0.17
Nodes (10): parseBody, validateRequest(), verifyInternalCall(), UserController, router, UserRoutes, UserValidation, globalRouter (+2 more)

### Community 31 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, jsx (+19 more)

### Community 32 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, declaration, declarationMap, exactOptionalPropertyTypes, isolatedModules, jsx, module, moduleDetection (+10 more)

### Community 33 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, @repo/eslint-config, @repo/typescript-config, @types/node, typescript, eslint, @repo/eslint-config (+9 more)

### Community 34 - "config/package.json"
Cohesion: 0.12
Nodes (16): dotenv, author, dependencies, dotenv, zod, description, exports, zod (+8 more)

### Community 35 - "logger/src/index.ts"
Cohesion: 0.15
Nodes (12): createKafkaClient(), EventBus, KafkaClientOptions, PublishOptions, consoleFormat, createLogger(), fileFormat, Logger (+4 more)

### Community 36 - "logger/package.json"
Cohesion: 0.12
Nodes (16): author, dependencies, winston, winston-daily-rotate-file, description, exports, keywords, license (+8 more)

### Community 37 - "auth-service/package.json"
Cohesion: 0.12
Nodes (16): author, description, keywords, license, main, name, packageManager, scripts (+8 more)

### Community 38 - "customer.service.ts"
Cohesion: 0.23
Nodes (14): BadRequestError, redisClient, createEventMetadata(), OtpPurpose, TOtpPurpose, emitDomainEvent(), provisionCustomer(), provisionSeller() (+6 more)

### Community 40 - "notification-service/package.json"
Cohesion: 0.12
Nodes (16): author, description, keywords, license, main, name, packageManager, scripts (+8 more)

### Community 41 - "user-service/package.json"
Cohesion: 0.12
Nodes (16): author, description, keywords, license, main, name, packageManager, scripts (+8 more)

### Community 42 - "compilerOptions"
Cohesion: 0.12
Nodes (14): compilerOptions, allowJs, jsx, module, moduleResolution, noEmit, plugins, extends (+6 more)

### Community 43 - "api-gateway/package.json"
Cohesion: 0.12
Nodes (15): author, description, keywords, license, main, name, packageManager, scripts (+7 more)

### Community 44 - "devDependencies"
Cohesion: 0.17
Nodes (12): @types/react, @types/react-dom, @types/react, @types/react-dom, devDependencies, @repo/typescript-config, @types/node, @types/react (+4 more)

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
Cohesion: 0.18
Nodes (9): EmailProviderError, EmailProviderErrorOptions, EmailProvider, SendEmailCommand, SendEmailResult, ResendEmailProvider, ResendEmailProviderOptions, ResendErrorResponse (+1 more)

### Community 49 - "shared-utils/package.json"
Cohesion: 0.14
Nodes (13): author, dependencies, description, exports, keywords, license, name, scripts (+5 more)

### Community 50 - "errors/package.json"
Cohesion: 0.15
Nodes (12): author, dependencies, description, exports, keywords, license, name, scripts (+4 more)

### Community 51 - "auth-service/src/app.ts"
Cohesion: 0.20
Nodes (12): handleZodError(), TErrorResponse, TErrorSource, TSimplifiedError, createApp(), globalErrorHandler(), notFoundHandler(), requestIdMiddleware() (+4 more)

### Community 52 - "auth-service/src/lib/prisma.ts"
Cohesion: 0.12
Nodes (26): config, KafkaTopics, EventBus, TDomainEvent, handleCustomerProfileCreated(), handleSellerProfileCreated(), startProvisionedProfilesConsumer(), calculateBackoff() (+18 more)

### Community 53 - "notification-service/src/lib/prisma.ts"
Cohesion: 0.22
Nodes (8): TNotificationType, claimNotification(), ClaimNotificationInput, IdempotencyResult, isUniqueConstraintViolation(), adapter, POOL_CONFIG, prisma

### Community 54 - "user-service/src/utils/logger.ts"
Cohesion: 0.18
Nodes (5): CircuitBreakerOptions, CircuitState, CircuitStateInternal, DEFAULT_OPTIONS, logger

### Community 55 - "user-service/src/events/outboxPoller.ts"
Cohesion: 0.26
Nodes (10): KafkaTopics, EventBus, calculateBackoff(), DEFAULT_OPTIONS, effectiveOptions, handleFailure(), OutboxPollerOptions, processNextBatch() (+2 more)

### Community 56 - "middlewares/idempotency.ts"
Cohesion: 0.23
Nodes (8): redisClient, IDEMPOTENCY_HEADER, idempotencyKey(), idempotencyMiddleware(), inMemoryStore, RateLimiterOptions, sendResponse(), TResponse

### Community 57 - "user.dto.ts"
Cohesion: 0.18
Nodes (11): AdminProfileDTO, CustomerProfileDTO, mapCustomerProfile(), mapShippingAddress(), SellerProfileDTO, ShippingAddressDTO, ShopAddressDTO, UpdateSellerDTO (+3 more)

### Community 58 - "web/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, plugins, strictNullChecks, exclude, extends, node_modules, exclude, dist (+1 more)

### Community 59 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, private, scripts, build, check-types (+3 more)

### Community 60 - "user-service/src/app.ts"
Cohesion: 0.28
Nodes (9): createMorganStream(), createApp(), globalErrorHandler(), notFoundHandler(), requestIdMiddleware(), DANGEROUS_PATTERNS, escapeHtml(), sanitizationMiddleware() (+1 more)

### Community 61 - "@nexus/logger"
Cohesion: 0.22
Nodes (9): ioredis, @nexus/logger, dependencies, ioredis, @nexus/logger, @nexus/logger, @nexus/logger, @nexus/logger (+1 more)

### Community 62 - "middlewares/circuitBreaker.ts"
Cohesion: 0.33
Nodes (9): circuitBreakerMiddleware(), CircuitBreakerState, getOrCreate(), getState(), isOpen(), recordFailure(), recordSuccess(), refreshState() (+1 more)

### Community 63 - "auth-service/src/middlewares/rateLimiter.ts"
Cohesion: 0.22
Nodes (8): inMemoryStore, rateLimiter(), RateLimiterOptions, router, CustomerRegisterRequestSchema, CustomerValidation, emailSchema, passwordSchema

### Community 64 - "auth.validation.ts"
Cohesion: 0.18
Nodes (10): emailSchema, loginValidationSchema, passwordSchema, provisionCustomerValidationSchema, provisionSellerValidationSchema, registerRequestValidationSchema, requestPasswordResetValidationSchema, resendOtpValidationSchema (+2 more)

### Community 65 - "config/src/index.ts"
Cohesion: 0.27
Nodes (7): corsSchema, jwtSchema, kafkaSchema, loadEnv(), nodeEnvSchema, optionalEnv(), requireEnv()

### Community 66 - "@repo/typescript-config/base.json"
Cohesion: 0.20
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src, @repo/typescript-config/base.json, extends

### Community 70 - "redis/package.json"
Cohesion: 0.17
Nodes (11): author, description, exports, keywords, license, name, scripts, build (+3 more)

### Community 71 - "kafka-consumer.ts"
Cohesion: 0.38
Nodes (7): KafkaTopics, startKafkaConsumer(), routePoisonMessage(), RoutePoisonMessageInput, RouteToDlqInput, parseKafkaMessage(), readHeader()

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
Cohesion: 0.33
Nodes (5): NotFoundError, formatUptime(), createApp(), globalErrorHandler(), notFoundHandler()

### Community 77 - "userServiceClient.ts"
Cohesion: 0.29
Nodes (6): axios, createUserProfile(), InternalAxiosRequestConfig, internalHeaders(), userServiceCircuitBreaker, userServiceClient

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

### Community 88 - "notification-service/tsconfig.json"
Cohesion: 0.25
Nodes (8): generated/*, baseUrl, exclude, include, dist, src/**/*, paths, @/generated/*

### Community 89 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, prettier, turbo, typescript, turbo, prettier

### Community 90 - "CircuitBreaker"
Cohesion: 0.21
Nodes (4): SlidingWindowRateLimiter, BackoffOptions, CircuitBreaker, NotificationServiceDeps

### Community 91 - "user-service/src/server.ts"
Cohesion: 0.53
Nodes (5): startOutboxPoller(), stopOutboxPoller(), disconnectPrisma(), main(), shutdown()

### Community 92 - "user-service/src/events/outboxWriter.ts"
Cohesion: 0.33
Nodes (6): TDomainEvent, TNotificationEvent, emitNotificationEvent(), eventTopicMap, writeOutboxEvent(), PrismaTransaction

### Community 93 - "@nexus/redis"
Cohesion: 0.40
Nodes (5): @nexus/redis, @nexus/redis, @nexus/redis, @nexus/redis, @nexus/redis

### Community 94 - "@nexus/shared-types"
Cohesion: 0.40
Nodes (5): @nexus/shared-types, @nexus/shared-types, @nexus/shared-types, @nexus/shared-types, @nexus/shared-types

### Community 95 - "devDependencies"
Cohesion: 0.12
Nodes (16): @types/express, @types/express, prisma, @types/express, @types/pg, prisma, @types/pg, devDependencies (+8 more)

### Community 96 - "morgan"
Cohesion: 0.50
Nodes (4): morgan, morgan, morgan, morgan

### Community 97 - "include"
Cohesion: 0.33
Nodes (6): include, next.config.js, next-env.d.ts, .next/types/**/*.ts, **/*.ts, **/*.tsx

### Community 99 - "@nexus/config"
Cohesion: 0.40
Nodes (5): @nexus/config, @nexus/config, @nexus/config, @nexus/config, @nexus/config

### Community 101 - "auth-service/src/types/express.d.ts"
Cohesion: 0.50
Nodes (3): Express, Request, TUser

### Community 102 - "user-service/src/types/express.d.ts"
Cohesion: 0.50
Nodes (3): Express, Request, TUser

### Community 109 - "@nexus/shared-utils"
Cohesion: 0.40
Nodes (5): @nexus/shared-utils, @nexus/shared-utils, @nexus/shared-utils, @nexus/shared-utils, @nexus/shared-utils

## Knowledge Gaps
- **675 isolated node(s):** `IdempotencyResult`, `RouteToDlqInput`, `RoutePoisonMessageInput`, `KafkaMessageHeaders`, `CORRELATION_ID_HEADERS` (+670 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `typescript` connect `typescript` to `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `devDependencies`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `@types/node` connect `typescript` to `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`, `devDependencies`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `IdempotencyResult`, `RouteToDlqInput`, `RoutePoisonMessageInput` to the rest of the system?**
  _675 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `outboxEvent.repository.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06748911465892599 - nodes in this community are weakly interconnected._
- **Should `user.validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._