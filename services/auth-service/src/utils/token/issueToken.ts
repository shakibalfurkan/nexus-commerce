import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { generateToken } from "./generateToken.js";
import config from "../../config/index.js";
import type { buildJwtPayload } from "./buildJwtPayload.js";

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function issueAccessToken(
  payload: ReturnType<typeof buildJwtPayload>,
): string {
  return generateToken(
    { ...payload, tokenType: "access" },
    config.jwt.access_token_secret,
    config.jwt.access_token_expires_in,
  );
}

export async function issueRefreshToken(
  payload: ReturnType<typeof buildJwtPayload>,
  credentialId: string,
  familyId?: string,
): Promise<{ token: string; familyId: string }> {
  const token = generateToken(
    { ...payload, tokenType: "refresh" },
    config.jwt.refresh_token_secret,
    config.jwt.refresh_token_expires_in,
  );

  const family = familyId ?? crypto.randomUUID();

  await prisma.refreshToken.create({
    data: {
      token,
      credentialId,
      familyId: family,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  });

  return { token, familyId: family };
}
