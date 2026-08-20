TASK: Improve packages/logger (Winston-based) for production correctness and
restructure from a single index.ts into multiple files. Staying on Winston —
not migrating to Pino.

CONTEXT:

- Most of the project's hosting (Render, free-tier containers) has an
  EPHEMERAL filesystem — files written to disk are lost on every restart/
  redeploy. The current DailyRotateFile transports only skip themselves on
  Vercel/Lambda (`isServerless` check), missing this same problem on Render
  and similar platforms.
- AGENTS.md mandates: structured logs with requestId/correlationId/traceId,
  never log secrets/PII. Neither is currently enforced by this package.

STEP 1 — Audit

- Confirm every service's actual deployment target and whether any of them
  genuinely have persistent disk (if all are ephemeral-container hosted,
  file transports should be removed/disabled entirely, not just gated)
- Find every place `logger.info/warn/error` is called across services with
  a `meta` object — check whether any currently pass sensitive fields
  (passwords, tokens, full payloads that might contain PII) so we know what
  the redact list needs to cover
- Report findings before proceeding

STEP 2 — Restructure packages/logger (one file per concern)
packages/logger/src/
format.ts — consoleFormat, fileFormat (if kept) as currently defined
redaction.ts — redact list (password, token, apiKey, otp, authorization
header, card numbers, etc.) applied via a custom Winston
format that recursively scrubs matching keys in `meta`
before any transport receives the log — this must run
for EVERY transport, not be opt-in per call site
transports.ts — transport construction; file transports become
opt-in via an explicit ENABLE_FILE_LOGGING env var,
defaulting to OFF, with a comment explaining why
(ephemeral hosting) — console/stdout transport is
always present and is the primary transport in
production
context.ts — child-logger helper for request-scoped context:
e.g. `withRequestContext(logger, { requestId,
                       correlationId, traceId })` returning a Winston child
logger with those fields bound, so call sites don't
manually merge them into every log call
logger.ts — createLogger(), unchanged core logic otherwise
types.ts — LoggerConfig, Logger, MorganStream interfaces
index.ts — barrel file, re-exports only

REQUIREMENTS:

- Redaction must be structural (a Winston format that walks the meta object
  and masks matching keys, e.g. replacing values with "[REDACTED]"), not a
  manual per-call-site convention
- File transports default OFF; only enabled if ENABLE_FILE_LOGGING=true is
  explicitly set — document in a comment why (ephemeral filesystem on most
  of this project's hosting targets)
- Child logger context helper must be usable in each service's request
  middleware to bind requestId/correlationId/traceId once per request,
  not require manually passing them into every individual log call
- Preserve existing behavior otherwise: colorized dev console format, JSON
  prod format, unhandledRejection/uncaughtException handlers, defaultMeta
  (service/env), Logger/MorganStream interfaces unchanged so no service call
  sites need to change their logger.info/error/etc calls
- Explicit types throughout, no implicit any

STEP 3 — Migrate

- No service-facing API changes expected (createLogger, createMorganStream
  keep their signatures) — confirm each service still builds after the
  restructure
- If any service explicitly relied on file logs being written (e.g. a
  monitoring script reading log files off disk), flag it — don't silently
  break something that depends on file output

STEP 4 — Commit

- Logical chunks: (1) audit report, (2) restructure + redaction + file-
  transport gating, (3) child-context helper, (4) any service call-site
  updates if the audit found unsafe fields being logged directly

Confirm Step 1 audit findings — especially deployment targets and any
currently-logged sensitive fields — with me before proceeding to Step 2.
