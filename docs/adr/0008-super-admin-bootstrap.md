# ADR 0008 — SUPER_ADMIN bootstrap via environment variables

## Context
Only a SUPER_ADMIN can create admin invites and there is no public admin
registration, so the first SUPER_ADMIN must be created outside the app.

## Decision
On startup, if no credential holds the SUPER_ADMIN role, create one from
`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (optional name overrides). Env
vars are declared optional in the main schema and validated only inside the
bootstrap. Two phases: Phase A (before listen) checks existence and validates
env; Phase B (after listen) creates with exponential backoff.

## Alternatives considered
- CLI command: rejected — requires shell access to prod and is error-prone.
- First-run setup page: rejected — expands attack surface and needs unauth
  write endpoint.

## Operational note
`SUPER_ADMIN_PASSWORD` can be removed from the environment once the account
exists, because the bootstrap does nothing when a SUPER_ADMIN is present.
