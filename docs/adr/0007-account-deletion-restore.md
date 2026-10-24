# ADR: Account deletion, restore flow, and 30/60-day grace periods

## Status

Accepted

## Context

Previously `/users/*` routes were public and soft delete did not emit events, so auth-service's credential replica was never informed and deletion did not block login. This ADR records the minimal restore/deletion flow.

## Decisions

- `user.deleted` is emitted via transactional outbox on soft delete, carrying `deletedAt` and `deletedBy (SELF | ADMIN)`.
- auth-service consumes `user.deleted`: marks credential deleted with `deletedAt`, revokes all refresh-token families (`SCAN auth:refresh:<id>:*`). Access tokens remain valid until expiry.
- Login reveals `ACCOUNT_DELETED` only when password is correct and within 30-day grace; otherwise generic invalid credentials.
- Owner restore allowed only if `deletedBy = SELF` and now < deletedAt + 30 days. Admin restore allowed within 60 days. After 60 days no restore.
- Admin delete is soft delete with `deletedBy = ADMIN`, not hard delete. Permanent delete only via purge/hard-delete path (internal/super-admin).
- Restore OTP stored as HMAC-SHA256 (server secret) at `auth:restore:<credentialId>`, 10-min TTL, max 5 attempts.
- Route access: `GET /users/email/:email` internal-only; owners use `GET/DELETE /users/me` (id from JWT); `:id` routes admin/internal only; restore internal-only.
- `reactivateWithin` removed (unused); `deletedAt` is sole source.
- Purge/anonymize job out of scope: should anonymize PII, keep order/payment records, propagate `user.hard_deleted`.
- Internal calls signed over `METHOD:PATH:TIMESTAMP:BODY` with constant-time comparison.
