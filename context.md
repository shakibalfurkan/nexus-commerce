# Context

## auth-service — Refresh token storage migration: Postgres → Redis (hashed)

### STEP 1 — Audit findings (completed 2026-09-06)

**Every place the `RefreshToken` Prisma model is read / written / queried:**

| Location | What it does |
|---|---|
| `services/auth-service/src/utils/token/issueToken.ts` → `issueRefreshToken(payload, credentialId, familyId?)` | Signs refresh JWT, **INSERTs plaintext token** row (`token`, `credentialId`, `familyId` = `familyId ?? crypto.randomUUID()`, `expiresAt = now + 7d` via local `REFRESH_TOKEN_EXPIRY_MS` constant). Called from `login()` and `verifyRegistration()` (both pass no `familyId` → new family per login) and from `refreshToken()` (passes existing `familyId` → rotation). |
| `services/auth-service/src/modules/auth/auth.service.ts` → `refreshToken(token)` (line ~464) | **Plaintext lookup** `prisma.refreshToken.findUnique({ where: { token }, include: { credential: true } })` ← **the security gap**. Then: `!storedToken` → 401; `isRevoked` → `revokeTokenFamily(familyId)` + `logger.warn("[RTR] Token reuse detected — revoked family …")` + 401; `expiresAt < now` → `revokeRefreshToken(token)` + 401; then `verifyToken(token, refresh_token_secret, "refresh")`; takes `activeRole` from decoded JWT; revokes old token; issues new access+refresh pair under **same** `familyId`. Returns `{ accessToken, refreshToken, role: credential.role }`. |
| `services/auth-service/src/modules/auth/auth.service.ts` → `logout(token)` | Calls `revokeRefreshToken(token)` (plaintext `updateMany` → `isRevoked: true`). |
| `services/auth-service/src/utils/token/revokeToken.ts` | `revokeTokenFamily(familyId)` and `revokeRefreshToken(token)` — both Prisma `updateMany`/`update` marking `isRevoked`. Only consumer is `auth.service.ts`. |
| `services/auth-service/src/modules/auth/auth.repository.ts` → `findRefreshToken`, `revokeRefreshToken`, `revokeTokenFamily` | **Dead code** — `AuthRepository.*` is only ever used for `findByEmail`/`findById`. The refresh-token functions here have zero call sites (service uses `utils/token/revokeToken.ts` instead). |
| `prisma/schema.prisma` | `RefreshToken` model (`@@map("refresh_tokens")`: id, token plaintext unique, credentialId, familyId default uuid, expiresAt, isRevoked, createdAt) + `Credential.refreshTokens` relation (only exists for this table). |

- **No session-listing feature exists** — no other reads of `refreshTokens`.
- Tests: `package.json` has no test script (`"test": "echo Error: no test specified"`). Verification will be `tsc` build + manual flow checks.

**Exact refresh JWT payload shape (confirmed from code):**

Signed by `generateToken()` (`HS256`) with `config.jwt.refresh_token_secret`, `expiresIn: config.jwt.refresh_token_expires_in` (default `"7d"`):

```json
{ "id": "<credentialId>", "email": "...", "role": ["CUSTOMER", ...], "activeRole": "CUSTOMER", "tokenType": "refresh", "iat": ..., "exp": ... }
```

- `credentialId` **IS recoverable by decoding** — it is the `id` claim.
- `familyId` is **NOT in the payload** — it lives only in the DB row. The TODO's assumption ("payload must already carry enough to reconstruct credentialId/familyId") is **half true**: `familyId` must be added as a JWT claim at issue time so rotation can decode `credentialId + familyId` without any store lookup. `familyId` is a random UUID, not secret — safe to embed in a signed JWT.
- `activeRole` is read from the old token during refresh (`decodedToken.activeRole`) and re-embedded into the new pair — rotation currently keeps the role from the presented token.

**Migration-relevant notes:**
- Redis client: shared `@nexus/redis` (ioredis wrapper) instantiated in `src/lib/redis.ts` as `redis`. Existing auth Redis usage follows `<service>:<purpose>:<id>` + TTL convention (`auth:otp:…`, `auth:reg:…`), so `auth:refresh:<credentialId>:<familyId>` fits.
- Current flow has no concurrency control (find → update → create non-atomic); TODO Step 4 requires Lua/MULTI for compare-then-overwrite during rotation.
- Deploy note: switching storage invalidates all existing refresh tokens (they live only in Postgres); users will be logged out unless a backfill is done. Accepted as part of this migration.
- Step 5 involves `DROP TABLE refresh_tokens` — destructive op, requires explicit approval + rollback plan per AGENTS.md.

**Decisions made:**
- Add `familyId` claim to the refresh JWT payload at issue time (required for key design `auth:refresh:<credentialId>:<familyId>`).
- New repo: `src/repositories/refreshToken.ts` (matches existing `repositories/credential.ts` pattern; uses `lib/redis.js` instance like other modules — consistent with current codebase style).
- `issueToken.ts` keeps only `issueAccessToken`; `utils/token/revokeToken.ts` is deleted (its logic moves into the new repo); dead Prisma refresh functions removed from `modules/auth/auth.repository.ts`.
- TTL semantics: refresh expiry is 7d from issue (sliding on rotation), matching current `expiresAt = now + 7d` per issuance.

---

### STEP 2 — Redis key design (completed 2026-09-06)

- Key: `auth:refresh:<credentialId>:<familyId>` — fits `<service>:<purpose>:<id>` convention (matches existing `auth:otp:…` / `auth:reg:…` patterns)
- Value: JSON `{ tokenHash: sha256(currentToken), createdAt: ISO }` — no `isRevoked` field; a hash mismatch on lookup IS the reuse signal
- TTL: `7 * 24 * 60 * 60` seconds (7d from issue, sliding on rotation — matches old `expiresAt = now + 7d` per issuance); Redis expires keys natively, no cleanup job
- Concurrency: rotation uses a Lua script (compare-hash-then-overwrite) so two concurrent refreshes on one family cannot both win; the loser is treated as reuse. (Note: unlike the rate limiter, refresh must fail CLOSED on Redis errors — without the store we cannot verify rotation/reuse, so errors propagate as 500.)

### STEP 3 — New Redis-backed repository (completed 2026-09-06)

New file `src/repositories/refreshToken.ts` (matches existing `repositories/credential.ts` pattern, uses the `lib/redis.js` ioredis instance like the rest of the module):

- `issueRefreshToken(payload, credentialId, familyId?)` — signs the JWT **with a new `familyId` claim embedded** (payload-shape fix from audit), `SET key value EX 7d` (new familyId = new login; same familyId = rotation)
- `findActiveTokenHash(credentialId, familyId)` — `GET` + parse, returns `tokenHash` or `null` (missing key = expired past TTL or already revoked; corrupt JSON logged + treated as null)
- `rotateRefreshToken(credentialId, familyId, expectedTokenHash, payload)` — Lua `EVAL` atomic compare-hash-then-overwrite; returns new token or `null` when the family was already rotated/expired (reuse signal)
- `revokeTokenFamily(credentialId, familyId)` — `DEL` the single family key (whole family shares one key holding only the current token)
- `revokeRefreshToken(token)` — decodes the JWT (`jwt.decode`, no throw on garbage) and `DEL`s the key; keeps the logout call site unchanged
- `hashRefreshToken(token)` — exported sha256 helper so the service flow and the repo share one hashing implementation

`ITokenPayload` (`utils/token/generateToken.ts`) extended with optional `activeRole` + `familyId` claims (only the refresh token embeds `familyId`; access tokens unchanged).

### STEP 4 — Rewritten refreshToken() flow (completed 2026-09-06)

`AuthService.refreshToken(token)` in `modules/auth/auth.service.ts` now:

1. `verifyToken(token, refresh_token_secret, "refresh")` FIRST — invalid signature / expired JWT rejects immediately with no Redis call (old DB expiry branch is gone; Redis TTL replaces `expiresAt` checks)
2. Decodes `credentialId` (= `id` claim) + `familyId` (+ `activeRole`) from the verified payload; missing `familyId`/`activeRole` → rejected as invalid (also covers pre-migration tokens signed without the claim)
3. `findActiveTokenHash(credentialId, familyId)` — `null` → `401 "Invalid refresh token"` (expired past TTL or already revoked)
4. `hashRefreshToken(token) !== storedTokenHash` → **reuse**: `revokeTokenFamily(credentialId, familyId)` (DELETE key) + the preserved `[RTR] Token reuse detected — revoked family … for credential …` warning + `UnauthorizedError("Refresh token has been revoked")`
5. MATCH → `rotateRefreshToken(...)` Lua compare-hash-then-overwrite under the SAME familyId; a `null` (lost a concurrent race) is treated as reuse with the same revoke + warning path; issues new access token from claims (`activeRole` carried from the presented token, as before) and returns the rotated refresh token

Call-site cleanup in the same change:
- `utils/token/issueToken.ts` — now only `issueAccessToken` (Prisma write + `issueRefreshToken` removed; `REFRESH_TOKEN_EXPIRY_MS` moved into the repo as `REFRESH_TOKEN_TTL_SECONDS`)
- `utils/token/revokeToken.ts` — deleted (Prisma revocation logic replaced by the repo)
- `modules/auth/auth.repository.ts` — dead Prisma refresh functions (`findRefreshToken`, `revokeRefreshToken`, `revokeTokenFamily`) removed; `logout()` call site unchanged (repo's `revokeRefreshToken(token)` handles decode + DEL)
- `tsc` build verified passing

Note: old behavior of `logout` on a garbage token was a Prisma P2025 throw; now it is a silent no-op (nothing to delete) — strictly better for a logout endpoint.

### STEP 5 — Postgres artifacts removed (completed 2026-09-06)

- Removed `RefreshToken` model (`@@map("refresh_tokens")`) from `prisma/schema.prisma`
- Removed the `Credential.refreshTokens` relation (it only existed for this table; `passwordResets` relation kept)
- Migration `20260906020804_remove_refresh_token_model` generated and **applied** to the Aiven Postgres `auth_db` (explicit user approval given; rollback plan: `git revert` + re-apply the original `20260119132125_refresh_token` DDL — the table held only revocable session state now owned by Redis)
- Verified: `pg_tables` now lists `_prisma_migrations, audit_logs, credentials, idempotency_records, outbox_events, password_resets` — `refresh_tokens` gone
- `prisma generate` re-run; generated client contains zero `RefreshToken` references; `tsc` build passing

### STEP 6 — Verification (completed 2026-09-06)

- `pnpm build` (tsc, strict) passes after every change
- No test suite exists in auth-service (`test` script is a placeholder), so verification was: type-check build, live DB inspection (table dropped), and code-path review of login → refresh → rotation → reuse → logout against the new repo
- Flow trace confirmed: login/verifyRegistration issue with new familyId (embedded in JWT + Redis key); refresh verifies JWT → hash compare → Lua rotation under SAME familyId (familyId persists across rotations since it is carried in the token payload and passed back into `rotateRefreshToken`); presenting the old rotated token → hash mismatch → family key deleted + `[RTR] Token reuse detected` warning; expired token (past TTL) → `findActiveTokenHash` returns null → clean 401; logout → `revokeRefreshToken` decodes + DELETEs family key
- Runtime E2E against live Redis/Kafka was not executed (no local Kafka broker/env guarantee); flagging as residual manual verification
