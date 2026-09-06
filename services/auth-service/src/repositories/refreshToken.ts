import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import { redis } from "../lib/redis.js";
import logger from "../utils/logger.js";
import { generateToken } from "../utils/token/generateToken.js";
import type { buildJwtPayload } from "../utils/token/buildJwtPayload.js";

/**
 * Redis-backed refresh token store (replaces the Postgres RefreshToken table).
 *
 * Key design: `auth:refresh:<credentialId>:<familyId>`
 * Value:      JSON { tokenHash: sha256(currentToken), createdAt }
 * TTL:        refresh token expiry (7d from issue, sliding on rotation) —
 *             Redis expires keys natively, so no isRevoked column or cleanup
 *             job is needed. A hash mismatch on lookup IS the reuse signal.
 *
 * Only the CURRENT token of a family is stored, so family-based revocation is
 * deleting a single key.
 */

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // matches REFRESH_TOKEN_EXPIRY (7d) semantics

const refreshKey = (credentialId: string, familyId: string): string =>
  `auth:refresh:${credentialId}:${familyId}`;

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const signRefreshToken = (
  payload: ReturnType<typeof buildJwtPayload>,
  familyId: string,
): string =>
  generateToken(
    { ...payload, tokenType: "refresh", familyId },
    config.jwt.refresh_token_secret,
    config.jwt.refresh_token_expires_in,
  );

const buildStoredValue = (token: string): string =>
  JSON.stringify({
    tokenHash: hashRefreshToken(token),
    createdAt: new Date().toISOString(),
  });

// Atomic compare-hash-then-overwrite for rotation: only succeeds if the stored
// hash still equals the hash of the token being rotated. Two concurrent
// refresh attempts on the same family cannot both win — the loser gets 0 and
// is treated as token reuse (same atomicity concern as the sliding-window
// rate limiter).
const ROTATE_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then return 0 end
local ok, parsed = pcall(cjson.decode, current)
if not ok or parsed.tokenHash ~= ARGV[1] then return 0 end
redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
return 1
`;

export async function issueRefreshToken(
  payload: ReturnType<typeof buildJwtPayload>,
  credentialId: string,
  familyId?: string,
): Promise<{ token: string; familyId: string }> {
  const family = familyId ?? crypto.randomUUID();
  const token = signRefreshToken(payload, family);

  await redis.set(
    refreshKey(credentialId, family),
    buildStoredValue(token),
    "EX",
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return { token, familyId: family };
}

export async function findActiveTokenHash(
  credentialId: string,
  familyId: string,
): Promise<string | null> {
  const raw = await redis.get(refreshKey(credentialId, familyId));
  if (!raw) {
    return null; // expired (past TTL) or already revoked
  }

  try {
    const parsed = JSON.parse(raw) as { tokenHash?: string };
    return parsed.tokenHash ?? null;
  } catch {
    logger.warn(
      `[RefreshTokenRepo] Corrupt value at refresh key — treating as revoked`,
      { credentialId, familyId },
    );
    return null;
  }
}

export async function rotateRefreshToken(
  credentialId: string,
  familyId: string,
  expectedTokenHash: string,
  payload: ReturnType<typeof buildJwtPayload>,
): Promise<{ token: string; familyId: string } | null> {
  const token = signRefreshToken(payload, familyId);

  const result = (await redis.eval(
    ROTATE_SCRIPT,
    1,
    refreshKey(credentialId, familyId),
    expectedTokenHash,
    buildStoredValue(token),
    String(REFRESH_TOKEN_TTL_SECONDS),
  )) as number;

  if (result !== 1) {
    return null; // key gone, or another refresh already rotated the family
  }

  return { token, familyId };
}

export async function revokeTokenFamily(
  credentialId: string,
  familyId: string,
): Promise<void> {
  await redis.del(refreshKey(credentialId, familyId));
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const decoded = jwt.decode(token) as
      | { id?: string; familyId?: string }
      | null;

    if (!decoded?.id || !decoded.familyId) {
      return; // undecodable token — nothing stored under a reconstructable key
    }

    await redis.del(refreshKey(decoded.id, decoded.familyId));
  } catch (err) {
    logger.warn(
      `[RefreshTokenRepo] Failed to decode refresh token during revocation`,
      { error: err instanceof Error ? err.message : String(err) },
    );
  }
}
