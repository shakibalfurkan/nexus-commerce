# Nexus — Logger Production-Hardening (TODO.md task) — Working Context

Last updated: 2026-08-20
Status: STEP 1–3 COMPLETE & VERIFIED. STEP 4 (commits) PENDING — awaiting
commit scope decision (see Pending below).

## Goal
Per TODO.md: harden `@nexus/logger` (Winston, staying on Winston) for production
correctness on ephemeral-filesystem hosting, restructure single `index.ts` into
per-concern files, add structural (format-level) redaction, gate file transports
OFF by default via `ENABLE_FILE_LOGGING`, and add a request-context child-logger
helper. No service-facing API changes intended (`createLogger`/`createMorganStream`
signatures preserved).

## Step 1 — Audit Findings

### A. Deployment targets (persistent disk?)
- No `render.yaml`, `Dockerfile`, `docker-compose`, `.github/workflows`, or any
  infra/CI config exists in the repo. Deployment target is NOT pinned by code.
- AGENTS.md states: "Free-tier only, no card on file: Neon/Aiven Postgres,
  Aiven Kafka (5-topic cap), Upstash Redis (shared), Resend, Render."
  → All backend services target **Render free-tier containers**, which have an
  **EPHEMERAL filesystem** (all 4 services: api-gateway, auth-service,
  user-service, notification-service).
- Conclusion: NONE of the services have persistent disk. DailyRotateFile writes
  to `process.cwd()/logs/...` are lost on every redeploy/restart. Current code
  only skips file transports on Vercel/Lambda (`isServerless`), so on Render the
  file transports are ACTIVE but pointless (writes vanish) AND cost disk I/O /
  open file handles for nothing.
- Decision (user-confirmed 2026-08-20 "gate OFF via env var, keep code"):
  DEFAULT OFF via `ENABLE_FILE_LOGGING` (explicit opt-in), matching STEP 2 /
  REQUIREMENTS. Keeps a local-dev escape hatch; no code removed.

### B. Sensitive fields currently logged?
Surveyed every `logger.{info,warn,error,debug,http}(...)` call with a meta object
across `services/` (auth, user, notification, api-gateway). No call site logs a
raw password, token string, or authorization header value. Specifics:
- `auth.service.ts:237` logs `{ requestId, error }` on registration failure;
  `userData` is spread into the *internal signature request body* but NOT into
  the log (password was already destructured out at :200). Safe.
- `globalErrorHandler.ts` (all 4 services) logs `logMetadata` =
  `{statusCode, errorType, isOperational, method, path, ip, requestId}` + `error`
  + `stack`. `error`/`stack` are Error objects (no secrets). `ip` is PII-bearing
  but low-risk and standard; redaction covers it only if key-named.
- `prisma.ts` slow-query logs emit `{ query, params, duration, target }`. Prisma
  `params` are positional `$1,$2,...` (values NOT interpolated), so they do not
  leak password plaintext. Acceptable.
- `resend-email.provider.ts:125` logs `{ messageId, to, subject }` — `to` is
  recipient email (PII). Structural redaction key-match will NOT hit `to`, so it
  stays logged (acceptable: standard; flag only).

### C. Redaction key set required (case-insensitive, recursive walk)
password, pass, pwd, token, apiKey, api_key, secret, authorization, auth, otp,
code, cardNumber, card_number, cardnumber, creditCard, credit_card, cvv,
pin, resetToken, reset_token, refreshToken, refresh_token, accessToken,
access_token, bearer, cookie, set-cookie, sessionId, session, privateKey,
private_key, ssn. Mask value → "[REDACTED]". Also mask nested objects/arrays
recursively. Apply as a Winston format BEFORE transports (runs for every
transport, not opt-in per call site).

### D. Service dependency on file logs?
- Grep for `logs/`, `readdir`, `readFile`, `fs.readFile` reading `.log` in
  `services/` → ZERO matches. No monitoring script reads log files off disk.
- Safe to default file transports OFF. No service will silently break.

## Step 2–3 Status (implemented + verified)

Files created/modified under `packages/logger/src/`:
- `types.ts` — LoggerConfig, Logger (added `child` method for context helper),
  MorganStream. No `any`; explicit Winston types.
- `format.ts` — `consoleFormat` (colorized dev) + `fileFormat` (JSON prod),
  unchanged logic from original index.ts.
- `redaction.ts` — `DEFAULT_REDACT_KEYS` (31 keys, case-insensitive) +
  recursive `redactValue` + `redactionFormat(extraKeys?)` Winston format. Uses
  `Record<string,true>` lookup (project rule: static string-keyed → Record, not
  Set); no trivial one-line wrappers.
- `transports.ts` — `buildTransports(config)`: Console ALWAYS present; the 3
  DailyRotateFile transports ONLY when `ENABLE_FILE_LOGGING=true` (default OFF),
  with comment explaining ephemeral Render hosting. Removed old `isServerless`
  gate.
- `context.ts` — `withRequestContext(logger, {requestId?, correlationId?,
  traceId?})` → `logger.child(...)`. (The `bindRequestContext` alias was dropped
  as a trivial rename — project rule.)
- `logger.ts` — `createLogger` + `createMorganStream` (signatures unchanged).
  Wires `redactionFormat()` into the pipeline BEFORE `fileFormat`, applied to
  every transport. Keeps defaultMeta + unhandledRejection/uncaughtException.
- `index.ts` — barrel re-exporting all submodules; old single-file logic removed.

Verification:
- `packages/logger` `check-types` (tsc --noEmit) → clean.
- `api-gateway`, `auth-service`, `notification-service` `build` (tsc) → clean
  against the new barrel (createLogger/createMorganStream imports intact).
- `user-service` `build` → FAILS with 48 PRE-EXISTING errors confined to Prisma
  repositories (user.repository.ts, auditLog.repository.ts,
  sellerProfile.repository.ts, shopAddress.repository.ts, user.dto.ts) — schema /
  generated-client drift, NONE in logger-consuming files. Confirmed
  `user.repository.ts` does NOT import `@nexus/logger`. Logger restructure is NOT
  the cause. Flagged, not fixed (out of scope; not introduced by this task).
- No service reads `logs/` off disk → gating file transports OFF breaks nothing.

Step 4 (service call-site fixes): NONE required — audit found no call site logs
raw secrets/PII. Redaction is structural defense-in-depth.

## Pending / Uncommitted
- All changes are uncommitted working-tree edits. TODO.md Step 4 asks 4 logical
  commits: (1) audit report (context.md), (2) restructure+redaction+gating,
  (3) child-context helper, (4) service call-site fixes (N/A — no fixes needed).
- IMPORTANT: the working tree ALSO contains unrelated prior modifications
  (AGENTS.md, event-contracts/topics.ts, a notification-service refactor,
  pnpm-lock drift). Commits MUST be scoped to logger work only to avoid bundling
  unrelated changes. The logger-work file set to stage:
  - packages/logger/src/index.ts (modified)
  - packages/logger/src/{types,format,redaction,transports,context,logger}.ts (new)
  - Optionally context.md (audit report) as its own commit.
- No commits made yet. Awaiting user go-ahead / scope on committing.

## Resume Instructions
- If resuming after a break: logger refactor is done & typechecks; only Step 4
  commits remain. Re-read `packages/logger/src/*` and this file; no re-audit
  needed unless deployment assumptions change.
- Build check command: `pnpm -C packages/logger check-types` and
  `pnpm -C services/<svc> build` (note user-service has pre-existing Prisma
  type errors unrelated to this work).
- No destructive ops performed.
