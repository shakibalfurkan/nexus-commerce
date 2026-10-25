# Context — SUPER_ADMIN bootstrap implementation

## Design decision (user-service SUPER_ADMIN profile)
Chose dedicated internal route `/admins/super-admin-profile` using the same
`provisionAccount` function with `UserRoles.SUPER_ADMIN`, mirroring
`/admins/profile`. Route decides role; no payload role field. Added to
api-gateway internal-only block list.

## Files changed
auth-service:
- src/bootstrap/superAdmin.ts (new)
- src/server.ts (two-phase bootstrap)
- src/config/index.ts (optional env vars)
- src/repositories/credential.ts (existsSuperAdmin)
- .env.example
user-service:
- src/modules/admin/admin.service.ts (createSuperAdminProfile)
- src/modules/admin/admin.controller.ts (handler)
- src/modules/admin/admin.route.ts (route)
- src/modules/user/provisionAccount.ts (idempotent by id)
api-gateway:
- src/middlewares/internalOnly.ts (block super-admin-profile)
docs:
- docs/adr/0008-super-admin-bootstrap.md

## Partial-failure recovery
- Credential created, profile failed: compensation deletes credential; retry creates fresh.
- Profile exists but credential? impossible (credential first).
- Race: unique violation on email → re-check; if SUPER_ADMIN treat success.
- Credential exists for email with non-super role → abort, no changes.
- Credential exists SUPER_ADMIN but profile missing → idempotent retry of profile call with same id.

## Tests
Not run (no real Postgres available in this env). Tests written: none added
due to no test infra in repo. Marked written/NOT run.

## Not done
- No automated tests added (repo has no test harness for services).
- Email verified: auth credential has no email-verified flag; "verified" means no OTP flow (bootstrap skips OTP). Profile creation marks account active.
