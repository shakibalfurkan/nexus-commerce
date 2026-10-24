# 0002 — Role-Specific Auth Flows, Admin Invites, and Role Replica Sync

- Status: Accepted
- Date: 2026-09-27
- Deciders: Nexus engineering

## Context

Registration and login were single, role-parameterised endpoints in
`auth-service` (`POST /auth/register-request`, `POST /auth/login`). The role was
carried in the request body, cross-checked against the `X-Client-Type` header,
and resolved through `deriveRequiredRole` / `mapBodyRoleToUserRole` /
`isAdminRole` helpers plus `if (role === …)` branches inside one handler. The
same handler therefore had to encode every role's rules, and user-service had
the matching problem: one internal endpoint (`POST /users/create-profile`) that
branched on `payload.role` to write the customer / seller / admin profile.

Two further constraints shaped this change:

1. **Dual-role accounts.** A single account may hold CUSTOMER and SELLER
   profiles, so login cannot be split "by role" — the same account must be able
   to sign in to either surface, each session keeping exactly one active role.
2. **Admin accounts are special.** ADMIN/SUPER_ADMIN must never be attached to a
   customer/seller identity and must never be self-registered.

## Problem

- A role that is "just another value in the body" has no route-level guard:
  every new role widens a shared handler, and any missed branch is an
  authorization bug rather than a missing route.
- Splitting by role alone breaks dual-role accounts; splitting by surface alone
  loses the per-role rules. Both axes are needed: routes split by
  role (registration) and by client surface (login), with the credential check
  shared.
- Admin creation needs an auditable, single-use, time-boxed path that does not
  exist for any other role, and ordinary ADMINs must not be able to mint more
  admins.
- `auth-service` owns credentials (password, roles, security state) while
  user-service owns profiles. Attaching a seller profile to an existing account
  (customer → also seller) therefore changes state in _two_ services, and
  cross-service database writes are forbidden.

## Decision

**1. Module split by role and surface (both services).**

```
auth-service: auth/ (shared)   customer/   seller/   admin/
user-service: user/ (shared)   customer/   seller/   admin/
```

- `modules/auth` holds only the shared mechanics: credential verification,
  session/token issuance, refresh/logout, password reset, the OTP-backed
  registration core, the client-surface guard, and the role-replica consumer.
- Each role module owns its schemas + routes; **no `role ===` branch remains**.
- Login is split by client surface (`/customers/login`, `/sellers/login`,
  `/admins/login`). The password is verified once against the shared identity;
  each surface then applies its own role gate. A missing profile is a
  distinguishable `NO_CUSTOMER_PROFILE` / `NO_SELLER_PROFILE` (the password was
  already correct), never a generic 401.
- user-service keeps a shared `provisionAccount()` sequence (user row → role
  profile → audit → `user.registered` event, one transaction) and receives the
  profile write as a callback, so three role routes share one contract without a
  branch and without triplicated code.
- Both services mount one router per role prefix and module routers declare
  relative paths only, so a role's surface is obvious from its mount point and
  no role-specific route hides under a shared prefix:
  - auth-service: `/auth` (session routes shared by every surface), `/customers`,
    `/sellers`, `/admins` (login + invites);
  - user-service: `/users` (generic, role-agnostic operations), `/customers`
    (registration + `/me/become-seller`), `/sellers` (registration), `/admins`
    (registration + dead-letter administration).
- The gateway namespaces by service prefix (`/auth-service`, `/user-service`),
  so the two services' `/customers`, `/sellers` and `/admins` routers never
  collide. The internal HMAC-signed profile endpoints
  (`/customers/profile`, `/sellers/profile`, `/admins/profile`) are rejected at
  the gateway so they are never reachable from outside.
- `superAdmin/` is intentionally not created in either service: invite creation
  is a `SUPER_ADMIN` route guard inside `admin/`, and user-service has no invite
  concept.

**2. Admin creation is invite-only.**

- No admin registration route exists (`/admins` has no `/register`). The only
  creation path is `POST /admins/invites/:token/accept`.
- Invites are **PostgreSQL** rows (`AdminInvite`), not Redis keys: the record is
  the audit trail (who invited whom, when, status history) and volume is far
  below the point where Redis's performance would compensate for losing it.
  Redis stays scoped to refresh tokens / password resets.
- Only the **sha256 hash** of the token is stored; the raw token exists solely
  in the emailed link, exactly like refresh tokens.
- The token is single-use (`markConsumed` is an `updateMany` filtered on
  `status: PENDING`, and it runs in the _same transaction_ as the credential
  insert). If the subsequent user-service profile call fails, the transaction is
  compensated — credential deleted, invite returned to `PENDING` — so there can
  never be a consumed token without an account, and the invitee can retry.
- Invite creation is guarded at the route (`authenticate` +
  `requireRole(SUPER_ADMIN)`), and `/admins/login` keeps the stricter policy
  (3 attempts / 5 min) rather than auto-issuing a session on invite acceptance.

**3. Role changes propagate by Kafka event, from the owning service.**

`POST /customers/me/become-seller` (user-service, authenticated CUSTOMER)
attaches a `SellerProfile` to the existing user, adds `SELLER` to `users.role`,
writes the audit log and emits `user.seller.profile.attached` — all in one
transaction (outbox). `auth-service` consumes that event and adds `SELLER` to the
credential's role list.

- The writer of each service's data stays its owner: user-service writes
  profiles + its own user record; auth-service writes credentials. No
  cross-service DB access, no service writing another service's tables.
- Delivery is eventually consistent and idempotent (role array union guarded by
  a compare-and-set `updateMany`); retries and the DLQ cover failures.
- A synchronous alternative (user-service calling a new auth-service internal
  endpoint) was rejected: it still needs compensation for the same partial
  failure window, while adding a write API to the credential owner and a new
  coupling direction.

**4. Events that produce no email must still validate.**

`notification-service` consumes the shared `domain-events` topic, so its
`DomainEventSchema` now accepts the domain events it does _not_ email
(`seller.profile.requested`, `customer.profile.requested`,
`user.seller.profile.attached`) and skips them via `isHandledDomainEvent`. Its
registry type maps only over emailed events. Before this, any such event on the
topic was classified as malformed and routed to the DLQ as a poison message.

## Consequences

- **Authorization is structural.** A role's routes exist in exactly one module
  with its own guard; a missing rule is a missing route, not a missed branch.
  Ordinary ADMINs are rejected from invite creation by the route guard.
- **Dual-role accounts work in both directions:** register as seller, register
  as customer, or attach a seller profile later — each surface issues a session
  with a single active role.
- **Latency:** becoming a seller grants the SELLER role in `auth-service` only
  after the outbox drains (poller interval, ADR 0001), so seller-app login
  succeeds a few seconds after `become-seller`. Accepted: the alternative
  reintroduces a cross-service write window.
- **Two sources of role truth remain** (credential replica + user record),
  reconciled by events. Both are written by their owner and are union-only,
  which makes the reconciliation idempotent.
- **Seller profile fields are limited to the schema** (name, phone, bio). Shop
  name / payout / tax columns do not exist, so those are not collected; adding
  them is a separate schema + PII decision, not a silent addition here.
