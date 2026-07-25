# Implementation Progress

## Task 1 — Cross-surface login validation

- [x] Audit existing login/register code paths
- [x] Add role field to login validation schema
- [x] Implement cross-validation helper (body.role vs X-Client-Type)
- [x] Refactor auth.service.ts login() with full cross-validation flow
- [x] Refactor auth.service.ts registerRequest() with cross-validation
- [x] Refactor auth.controller.ts to pass clientType to service
- [x] Add AuditLog logging for ROLE_HEADER_BODY_MISMATCH
- [x] Handle admin denial securely (generic 403, no hints)

## Task 2 — Self-service profile provisioning

- [x] Add provision endpoints to auth.route.ts
- [x] Add provision controller handlers
- [x] Add provision service methods (emit domain event, 202 response)
- [x] Add new event types (SELLER_PROFILE_REQUESTED, CUSTOMER_PROFILE_REQUESTED)
- [x] Add Kafka consumer for SellerProfileCreated/CustomerProfileCreated
- [x] Add credential.roles update logic in consumer (version check pattern)
- [x] Add auth middleware for authenticated routes

## Task 3 — Generic OTP refactor

- [x] Create OtpPurpose enum/constant
- [x] Parameterize resendOtp by purpose
- [x] Update Redis key structure to include purpose
- [x] Update verifyOtp to check purpose
- [x] Update rate limiting to be per-purpose per-user
- [x] Update registerRequest to use new generic OTP flow

## Task 4 — Audit & report

- [x] Pre-implementation scan of all relevant code
- [x] Post-implementation summary
