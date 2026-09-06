TASK: Migrate refresh token storage from PostgreSQL (RefreshToken table) to
Redis, in auth-service. Preserve existing rotation + family-based reuse
detection logic exactly, but fix a security gap found during migration:
tokens are currently stored/looked-up in plaintext — switch to hashed
storage.

CONTEXT — current implementation (for reference, do not assume, verify
against actual code):

- refreshToken() flow: look up RefreshToken by raw `token` string (plaintext
  lookup — SECURITY GAP, fix this), check isRevoked/expiresAt, verify JWT
  signature, revoke the used token, issue new access+refresh token pair
  under the same familyId, return new tokens
- RefreshToken model: id, token (plaintext, unique), credentialId, familyId
  (default uuid, persists across a rotation chain), expiresAt, isRevoked,
  createdAt
- revokeTokenFamily(familyId) already exists — used when reuse is detected
- The refresh token itself is a signed JWT (verified via verifyToken() with
  a dedicated refresh_token_secret), not an opaque random string — its
  payload must already carry enough to reconstruct credentialId/familyId,
  confirm exactly what's in the payload during audit

STEP 1 — Audit

- Find every place RefreshToken (Prisma model) is read, written, or queried:
  refreshToken(), issueRefreshToken(), revokeRefreshToken(),
  revokeTokenFamily(), logout logic, any session-listing feature
- Confirm exact JWT payload shape for the refresh token (what claims does
  issueRefreshToken() embed — does it include credentialId and familyId
  already, so they're recoverable purely by decoding, without a DB lookup?)
- Report findings before proceeding

STEP 2 — Redis key design

- Key: `auth:refresh:<credentialId>:<familyId>`
- Value: JSON { tokenHash: sha256(currentToken), createdAt } — no isRevoked
  field needed; a hash mismatch on lookup IS the reuse signal (see Step 4)
- TTL: set to the refresh token's actual expiry duration (matches current
  `expiresAt` semantics) — Redis expires it natively, no cleanup job needed

STEP 3 — New repository (repositories/refreshToken.ts), Redis-backed
Implement, matching current function names/signatures where reasonable so
call sites change minimally:

- issueRefreshToken(payload, credentialId, familyId?) — generate JWT,
  SET the Redis key (new familyId if none passed = new login; same
  familyId = rotation) with tokenHash + TTL
- findActiveTokenHash(credentialId, familyId) — GET + parse the Redis
  value, return null if key doesn't exist (expired or already revoked)
- revokeRefreshToken / revokeTokenFamily(credentialId, familyId) — DELETE
  the Redis key outright (family-based revocation is now just deleting
  one key, since the whole family shares one key holding the CURRENT
  token only)

STEP 4 — Rewrite refreshToken() flow

1. Verify JWT signature/expiry via existing verifyToken() first (invalid
   signature or expired JWT → reject immediately, no Redis call needed)
2. Decode payload to get credentialId + familyId
3. findActiveTokenHash(credentialId, familyId) — if null, treat as
   invalid/expired, reject
4. Compare sha256(presentedToken) against the stored hash:
   - MATCH → proceed: issue new access+refresh token pair under the SAME
     familyId, overwrite the Redis key with the new tokenHash (rotation)
   - MISMATCH → this is reuse of an already-rotated token — call
     revokeTokenFamily(credentialId, familyId) to delete the key entirely,
     log a warning (preserve the existing "[RTR] Token reuse detected" log
     line and its context), reject with UnauthorizedError

- Use a Redis MULTI/EXEC or Lua script for the compare-then-overwrite step
  in the MATCH case, so two concurrent refresh attempts on the same family
  can't race each other into an inconsistent state (same atomicity concern
  as the sliding-window rate limiter's Lua script)

STEP 5 — Remove Postgres artifacts

- Remove RefreshToken model from schema.prisma, generate + apply a migration
  to drop refresh_tokens table
- Remove the Prisma relation from Credential model if it only existed for
  this table

STEP 6 — Verify

- Login → refresh → rotation works, familyId persists across rotations
- Presenting an old (already-rotated) refresh token triggers full family
  revocation and logs the existing warning message
- Expired token (past Redis TTL) is rejected cleanly
- Logout revokes the family
- auth-service builds, existing tests pass

STEP 7 — Commits, logical chunks:
(1) audit report, (2) new Redis-backed repository, (3) rewritten
refreshToken() flow with hash comparison, (4) remove Postgres model +
migration, (5) any call-site cleanup

Report Step 1 findings — especially the exact refresh JWT payload shape —
before proceeding to Step 2.
