import { generateToken } from "./generateToken.js";
import config from "../../config/index.js";
import type { buildJwtPayload } from "./buildJwtPayload.js";

export function issueAccessToken(
  payload: ReturnType<typeof buildJwtPayload>,
): string {
  return generateToken(
    { ...payload, tokenType: "access" },
    config.jwt.access_token_secret,
    config.jwt.access_token_expires_in,
  );
}
