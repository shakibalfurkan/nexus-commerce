import { createHmac } from "node:crypto";
import { InternalServerError } from "../errors/AppError.js";

// ─── Constants ───
const ALGORITHM = "sha256" as const;
const OUTPUT_ENCODING = "hex" as const;

// ─── Domain Secret Management ───
function getDomainSecret(): string {
  const secret = process.env.BLIND_INDEX_SECRET;
  if (!secret) {
    throw new InternalServerError(
      "BLIND_INDEX_SECRET environment variable is required for PII blind indexing",
    );
  }
  return secret;
}

// ─── Blind Index Computation ───

export function computeBlindIndex(value: string): string {
  const secret = getDomainSecret();
  const normalizedValue = value.toLowerCase().trim();

  return createHmac(ALGORITHM, secret)
    .update(normalizedValue, "utf-8")
    .digest(OUTPUT_ENCODING);
}

export function computeEmailBlindIndex(email: string): string {
  const normalizedEmail = normalizeEmail(email);
  return computeBlindIndex(normalizedEmail);
}

function normalizeEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) {
    return email.toLowerCase().trim();
  }

  let localPart = email.slice(0, atIndex).toLowerCase().trim();
  const domain = email
    .slice(atIndex + 1)
    .toLowerCase()
    .trim();

  if (domain === "gmail.com" || domain === "googlemail.com") {
    localPart = localPart.split("+")[0]!.replace(/\./g, "");
  }

  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com"
  ) {
    localPart = localPart.split("+")[0]!;
  }

  return `${localPart}@${domain}`;
}

export function verifyBlindIndex(
  value: string,
  expectedBlindIndex: string,
): boolean {
  const computed = computeBlindIndex(value);
  return computed === expectedBlindIndex;
}
