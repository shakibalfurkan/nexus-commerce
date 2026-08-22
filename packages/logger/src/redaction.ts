import winston from "winston";
/**
 * Default keys whose values must never reach a transport. Matching is
 * case-insensitive and covers common camelCase/snake_case variants. This list
 * is the single source of truth for secret/PII redaction and is applied
 * structurally at the format layer — call sites never opt in.
 */
export const DEFAULT_REDACT_KEYS: readonly string[] = [
  "password",
  "pass",
  "pwd",
  "token",
  "apikey",
  "api_key",
  "secret",
  "authorization",
  "auth",
  "otp",
  "code",
  "cardnumber",
  "card_number",
  "creditcard",
  "credit_card",
  "cvv",
  "pin",
  "resettoken",
  "reset_token",
  "refreshtoken",
  "refresh_token",
  "accesstoken",
  "access_token",
  "bearer",
  "cookie",
  "set-cookie",
  "sessionid",
  "session",
  "privatekey",
  "private_key",
  "ssn",
] as const;

const REDACTED = "[REDACTED]";

/** Lowercased static lookup built once from {@link DEFAULT_REDACT_KEYS}. */
const DEFAULT_REDACT_RECORD: Record<string, true> = Object.fromEntries(
  DEFAULT_REDACT_KEYS.map((k) => [k.toLowerCase(), true] as const),
);

/**
 * Recursively walk a value and replace any leaf whose key (case-insensitive)
 * matches `keys` with {@link REDACTED}. Arrays and nested objects are traversed
 * via a fresh copy; primitives and unmatched leaves pass through.
 *
 * Returning a new structure (rather than mutating) keeps Winston's info object
 * immutable for other formats later in the pipeline.
 */
function redactValue(value: unknown, keys: Record<string, true>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, keys));
  }

  if (value !== null && typeof value === "object") {
    const out: Record<string | symbol, unknown> = {};
    // Winston tags every log entry with Symbol(level)/Symbol(message) keys,
    // and transports gate writes on `info[LEVEL]` (see winston-transport's
    // TransportStream._write). Object.entries() ignores symbol keys, so they
    // must be copied over explicitly — dropping them makes the level lookup
    // undefined, fails the gate comparison, and silently discards EVERY log
    // line at every transport. Symbols are winston-internal bookkeeping, not
    // user data, so they pass through unredacted.
    for (const sym of Object.getOwnPropertySymbols(value)) {
      out[sym] = (value as Record<symbol, unknown>)[sym];
    }
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      out[key] = lower in keys ? REDACTED : redactValue(val, keys);
    }
    return out;
  }

  return value;
}
/**
 * Winston format that scrubs matching keys from the entire `info` object
 * (message excluded) before any transport sees it. Applied unconditionally in
 * {@link createLogger}, so redaction is not opt-in per call site.
 *
 * @param extraKeys Service-specific keys to additionally redact alongside the
 *   defaults (lower-cased automatically).
 */
export function redactionFormat(
  extraKeys: readonly string[] = [],
): winston.Logform.Format {
  const record: Record<string, true> = { ...DEFAULT_REDACT_RECORD };
  for (const key of extraKeys) {
    record[key.toLowerCase()] = true;
  }

  const transform = (info: winston.Logform.TransformableInfo) => {
    const scrubbed = redactValue({ ...info }, record);
    return scrubbed as winston.Logform.TransformableInfo;
  };

  return winston.format(transform)();
}
