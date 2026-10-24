# Context

## user-service + auth-service cleanup & audit after the role-split refactor (completed 2026-10-07)

Status: all six TODO.md parts done. No commits made (the working tree also
carries the earlier role-split refactor as uncommitted WIP — reviewed, not
touched beyond this task). No committed state changed except the edits below.

### Part 1 — role removal: VERIFIED clean (no leftovers)

- Wire payload sent by `auth-service/lib/axiosClients/userServiceClient.ts` is
  `{ id, email, profile }` only — no `role` key (line 187-191). The remaining
  `CreateUserProfileInput.role: TProvisionableRole` is the client-side ENDPOINT
  SELECTOR (`PROFILE_ENDPOINTS[input.role]`, plus log fields) — read, never
  serialized, never validated by user-service. Removing it would need three
  per-role client functions (forbidden new abstraction), so it stays.
- user-service provisioning schemas (customer, seller, admin) contain no `role`
  field; no `z.literal(role)` anywhere in user-service; no `req.body.role` read.
- Role for each provisioning call comes from the route module's own service as a
  constant (`customer`: `UserRoles.CUSTOMER`, `seller`: `UserRoles.SELLER`,
  `admin`: `UserRoles.ADMIN`) — never from the request. auth-service:
  `customer`/`seller` services pass `UserRoles.CUSTOMER`/`SELLER` through
  `completeRegistration`; `admin` service passes `UserRoles.ADMIN`.
- tests/docs/ADRs: ADR 0002 mentions `payload.role` only as history of the old
  problem (Context section) — correct, not stale. No test suites exist.

### Part 2 — dead-letter consolidation: DONE

`modules/dead-letter-event/` owns everything:

```
deadLetter.route.ts            — router, router-level auth(ADMIN, SUPER_ADMIN),
                               relative paths only: GET "/" and POST "/:id/redrive"
deadLetter.controller.ts
deadLetter.validation.ts
deadLetterEvent.repository.ts
deadLetterConsumer.ts
startDeadLetterConsumer.ts
```

- Deleted: `modules/admin/adminDeadLetter.controller.ts`,
  `modules/admin/adminDeadLetter.validation.ts` (identical duplicates).
- `admin.route.ts`: dead-letter routes + imports removed; module keeps only
  `POST /profile` (HMAC). Zero dead-letter references remain.
- `routes/index.ts`: mounted `DeadLetterRoutes` at `/admins/dead-letters`
  BEFORE the `/admins` entry (order documented in a comment).
- `AdminRoutes` carries no router-level middleware (verified: no `router.use`
  in the file) — nothing else can run for dead-letter requests.
- Public URLs unchanged and probed live: `GET /admins/dead-letters` → 401
  without token; `POST /admins/dead-letters/:id/redrive` → 401; old
  `/admin/dead-letters` (singular) → 404. No aliases added.

### Part 3 — become-seller consolidation: DONE

Feature now lives entirely in `modules/customer` (route → controller →
validation → service): `POST /customers/me/become-seller` +
`auth(UserRoles.CUSTOMER)` route, `CustomerProfileController.becomeSeller`,
`becomeSellerSchema` (built from shared `profileFields` primitives — no
duplication, nothing imported from the seller module), `BecomeSellerInput`
type, and the `becomeSeller` service function, exported via
`CustomerProfileService`.

- Moved from `modules/seller`: `becomeSeller` + `BecomeSellerInput` +
  `ADMIN_ROLES`/`isAdminRole` (used only by this flow). Checks in identical
  order (user exists → admin identities rejected → seller conflict), identical
  transaction contents (create seller profile, add SELLER role, audit log,
  outbox event `user.seller.profile.attached` payload `{userId, email}`),
  same cache invalidation, same response/message.
- Database access already shared — no move needed: `UserRepository`
  (`findUserById/createSellerProfile/addRole/writeAuditLog/invalidateUserCache`
  in the shared `modules/user` module), `prisma.$transaction`, `emitDomainEvent`.
- `modules/seller` keeps only seller-profile provisioning (`POST
  /sellers/profile`); no re-exports, no forwarding functions. Grep-confirmed:
  `modules/customer` has no imports from `modules/seller` and vice versa.

### Part 4 — auth-service auditLog writer: VERIFIED, one import-style fix

- `src/repositories/auditLog.ts` confirmed (not under modules/), function
  `writeAuditLog` + type `AuditLogInput` already renamed (no
  `writeAuthAuditLog`/`AuthAuditLogInput`/`modules/auth/auditLog` references
  remain in src; only gitignored `dist/` had stale copies).
- Mismatch found and fixed (pure import fix): both call sites used a named
  import while `credential.ts`/`adminInvite.ts` use namespace imports.
  Converted `auth.service.ts` + `admin.service.ts` to
  `import * as AuditLogRepository` with `AuditLogRepository.writeAuditLog(...)`
  calls — mirrors `UserRepository.writeAuditLog`.
- All three callers inside `prisma.$transaction` pass `tx` (admin service:
  invite-created/consumed/rolled-back). Callers outside transactions pass the
  global `prisma` (client-surface guard, admin-login-denied, role sync) — correct.
- Written fields byte-identical to the pre-move writer (actorId, action,
  targetId, targetType, ipAddress, userAgent, oldValues, newValues, metadata).

### Part 5 — audit (knip + strict tsc + reads). Findings table

| # | File | Issue | Cat | Action | Risk |
|---|------|-------|-----|--------|------|
| 1 | user `adminDeadLetter.*` + admin routes | duplicate dead-letter HTTP layer | f | deleted + routes stripped (Part 2) | none — consolidation |
| 2 | user `modules/customer` vs `modules/seller` | one feature split across two role modules | f | moved into customer (Part 3) | none — verbatim move |
| 3 | auth `auditLog` import style | named import vs namespace convention | d | converted to `* as AuditLogRepository` (Part 4) | none |
| 4 | user `middlewares/bodyParser.ts` | `parseBody` never mounted; legacy `data`-key unwrap | b | deleted file | none |
| 5 | user `middlewares/idempotency.ts` | `idempotencyMiddleware` never mounted ("Sprint 4" never happened) | b | deleted file; removed now-dead `idempotencyKey` from `global.d.ts` | none |
| 6 | user `middlewares/rateLimiter.ts` | never imported (user-service has no public auth endpoints) | b | deleted file | none — note: AGENTS fail-open rate-limit rule was also violated here anyway (no fallback would matter since unused) |
| 7 | user `cacheKeys.userExistsKey/userListKey` | zero call sites | b | deleted | none |
| 8 | user `cacheManager.cacheInvalidateMany/clearL1Cache/getRedisCircuitState` | zero call sites | b | deleted | none |
| 9 | user `UserRepository.existsById/listUsers` + `ListUsersFilters` | unused repository functions, no route ever existed | b | deleted function + interface | none |
| 10 | auth `repositories/credential.ts` ×5 (`findByEmailExcludingDeleted`, `createCredential`, `increment/resetFailedLoginAttempts`, `lockAccount`) | unused exports; login flow uses `utils/handleLogin.ts` instead | b+c | deleted the five | none — `checkLockout/handleFailedLogin/resetLoginAttempts` in `handleLogin` are the live implementations |
| 11 | auth `constant/index.ts` | empty (1 byte), no importers | b | deleted file | none |
| 12 | auth `events/outboxWriter.ts` | re-export shim, zero importers (pollers import `@nexus/kafka` directly) | b+f | deleted file | none |
| 13 | user `types/express.d.ts` | duplicate `Express.Request` augmentation — `global.d.ts` declares identical `user` + `requestId` | c | deleted file; tsc clean without it | none |
| 14 | auth `lib/kafka.ts` `KafkaTopics` re-export | nothing imports it from there (consumers use `@nexus/event-contracts`) | b+f | dropped from re-export + its import | none |
| 15 | auth `userServiceClient`: `internalHeaders` export, `default` export; auth `auth.validation` 7 primitives; `notFoundHandler` named exports (user/auth/gateway) | exported but only used in-file / via aggregate objects (`AuthValidation`, `*Service` objects); services export functions twice (bare + object) | b | removed redundant `export` keywords (kept objects/defaults); auth.service-style convention already does plain-fns + object | none |
| 16 | gateway `circuitBreaker.getState/reset` | zero call sites | b | deleted both | none |
| 17 | gateway `circuitBreaker.recordSuccess/recordFailure/isOpen` | internal-only | b | un-exported (still used by the middleware) | none |
| 18 | `seller.validation.ts` `UserRoles` import; auth `lib/redis.ts` `InternalServerError`; gateway `config` `optionalEnv` | unused imports (strict-tsc leads) | b | removed | none |
| 19 | user `pagination/encodeCursor` | used only inside `cursorPagination.ts` | b | un-exported | none |
| 20 | user-service package.json: `axios`, `uuid`, `@types/uuid`, `pg`, `@types/pg`; auth-service: `pg`, `@types/pg` | zero imports in src (grep-verified); `uuid` only used the deleted middleware | b | REVERTED, not applied: lockfile sync requires a working `pnpm install`, and this environment's root pnpm 9 refuses the pnpm-10.25.0-built `node_modules` (interactive wipe prompt) while the network is too slow to reinstall; leaving manifests + lockfile untouched is the smaller risk. Zero functional impact either way (nothing imports them). Remove in a connected session | none |
| 21 | user `.env.example`: `BCRYPT_SALT_ROUND`, `*_EXPIRES_IN`, `JWT_RESET_TOKEN_*`, `USER_SERVICE_URL` | not read by config; missing required `KAFKA_*` + `SERVICE_NAME` | e | rewrote example to match `config/index.ts` + `lib/prisma.ts` exactly | none — docs only |
| 22 | auth `auth.validations/loginValidationSchema` etc. | knip-unique-export noise, but all consumed via `AuthValidation.*`; module doc intends the primitives as API | — | left, documented | none |
| 23 | auth `handleLogin.ts` direct `prisma.credential.update` in utils (data access outside `src/repositories`) | d | left: pre-existing pattern (auth service also writes credentials inline); moving live login-lockout logic is churn beyond cleanup | none |

### Chose NOT to change (needs approval — contract/behavior boundary)

- `seller.profile.requested` / `customer.profile.requested` event contracts
  (`packages/event-contracts`): no producer remains (auth-service's old
  `provisionSeller`/`provisionCustomer` were removed in the refactor);
  notification-service still accepts them and kafka tests still route them.
  Event-contract change → recommend removal (schemas, notification acceptance,
  test refs, ADR §4 sentence) after confirming no in-flight messages. NOT
  CHANGED.
- `user.registered` event payload `role`: produced by `provisionAccount`, read
  by no consumer (notification uses email/firstName only). Event contract →
  left. Recommend: keep (cheap, may serve future consumers) or drop in a
  contract revision.
- `requestedRole: z.literal(...)` on those dead events: same mistake class as the
  original (value fully determined by `eventType`) — but inside protected
  event contracts → left, remove together with the schemas above.
- `addRoleToCredential` (role sync): `updateMany` guard + audit write are not
  wrapped in one transaction — a failed audit after a successful role add is
  permanently skipped on redelivery (early-return on `role.includes`). Recommend
  `prisma.$transaction` around both. NOT CHANGED (runtime behavior).
- **`GET /users/:id`, `GET /users/email/:email`, `DELETE /users/:id[/hard]`,
  `POST /users/:id/restore` have NO auth middleware** (verified in
  `user.route.ts`); controllers fall back to `actorId = "system"`. The
  api-gateway proxies `/user-service/users/*` without a user-session check
  (`internalOnly` blocks only the three `/profile` paths). So user
  read/delete/restore and the audit actor attribution are effectively public.
  Pre-existing, not introduced by the refactor; AGENTS.js requires
  authenticated → authorized → ownership-checked on every protected endpoint.
  Recommend `auth(...)` (+ ownership) or deny-listing these paths at the
  gateway. NOT CHANGED (auth behavior).
- Package/notification knip findings (`@prisma/client`, `pg`, `react-dom`,
  notification-service exports/types, `next` unresolved import, `dotenv`
  unlisted in `prisma.config.ts`): out of Part-5 scope (other packages) or
  false positives — left.
- `TProvisionableRole`, DTO types (`*DTO`), `ITokenPayload`/`IDecodedToken`,
  `TInviteValidationStatus`: knip-flagged but referenced by exported function/
  type signatures under `declaration: true` — un-exporting breaks declaration
  emit. Left.

### Part 6 — verify

- `tsc --noEmit` clean: user-service, auth-service, api-gateway (exit 0 each).
- `tsc --noEmit --noUnusedLocals --noUnusedParameters`: clean in all three
  (the 4 baseline violations above are gone).
- `pnpm run check-types`: 10/10 tasks pass.
- `pnpm run build`: 13/13 tasks pass (baseline also 13/13 — no regression).
- Route probes over real HTTP against `createApp()` (dummy envs, no DB/Redis):

```
user-service route table (before → after: IDENTICAL, `diff` empty)
GET /                          → 404   (welcome lives at root "/" → see below)
GET /api/v1/health             → 404   (health lives at root "/health")
GET /api/v1/users/email/:email → 503   (offline: no DB)
GET /api/v1/users/:id          → 503   (offline: no DB)
DELETE /api/v1/users/:id       → 503   (offline: no DB)
DELETE /api/v1/users/:id/hard  → 503   (offline: no DB)
POST /api/v1/users/:id/restore → 503   (offline: no DB)
POST /api/v1/customers/profile → 401   (HMAC guard runs)
POST /api/v1/customers/me/become-seller → 401  (auth guard runs)
POST /api/v1/sellers/profile   → 401   (HMAC guard runs)
POST /api/v1/admins/profile    → 401   (HMAC guard runs)
GET /api/v1/admins/dead-letters → 401  (router auth runs; via DeadLetterRoutes now)
POST /api/v1/admins/dead-letters/:id/redrive → 401
GET /api/v1/admin/dead-letters (old)   → 404
POST /api/v1/admin/dead-letters/:id/redrive (old) → 404
POST /api/v1/users/create-profile (old) → 404
GET /api/v1/admins | /customers | /sellers → 404 (prefixes have no root route)
GET /         → 200   (welcome)
GET /health   → 200
```

auth-service route table (probed, live Redis from its `.env`):

```
GET /            → 200
GET /health      → 200
POST /api/v1/auth/refresh-token              → 401 (garbage token)
POST /api/v1/auth/register-request (old)     → 404
POST /api/v1/auth/login (old)                → 404
POST /api/v1/customers/register|/login       → 400 (validation runs)
POST /api/v1/sellers/register|/login         → 400
POST /api/v1/admins/login                    → 400
GET  /api/v1/admins/invites/:token           → 400
POST /api/v1/admins/invites                  → 401 (SUPER_ADMIN guard runs)
```

- Grep: `modules/customer` has no imports from `modules/seller` and
  `modules/seller` has none from `modules/customer` (exit 1, clean).
- Same grep across auth-service role modules (customer/seller/admin): clean —
  they only import the shared `../auth/*` module.
- Rebuilt `dist/` for user-service + auth-service to purge stale artifacts
  (old `adminDeadLetter.*`, `writeAuthAuditLog`, removed repositories).
- Probe scripts were temporary (repo root, deleted).

### Env/tooling notes

- user-service has no `.env`; probes used dummy envs. Root `packageManager` says pnpm@9.0.0 but every 
  service declares `pnpm@10.25.0` and `node_modules/.modules.yaml` is 10.25.0. Running `pnpm install` 
  from root (pnpm 9) ALWAYS prompts to wipe and reinstall `node_modules` from scratch (pre-existing, 
  independent of this task) - use corepack pnpm@10.25.0 for installs, and consider aligning root 
  `packageManager` to 10.25.0. A pnpm 10.25.0 lockfile rewrite also reformats the kafkajs `patch_hash` 
  entry; that rewrite was reverted to keep this task's diff free of toolchain churn.
- `npx knip` panics on Prisma config files (`dotenv/config` unresolvable from
  root) — knip environment artifact; output otherwise used as leads only.
- Lockfile diff includes a kafkajs `patch_hash` format rewrite (patch applied
  identically) — produced by pnpm 10.25.0 (the version that built the tree).
