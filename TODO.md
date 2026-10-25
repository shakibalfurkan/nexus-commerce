TASK: Implement SUPER_ADMIN bootstrap on startup in auth-service
(with the small user-service change it needs). Follow the existing
conventions in AGENTS.md (YAGNI, simplicity first, no new libraries, no
over-abstraction).

WHY
Only a SUPER_ADMIN can create admin invites and there is no public admin
registration, so the first SUPER_ADMIN must be created outside the app.
Approach: on startup, if no SUPER_ADMIN exists, create one from environment
variables. If one already exists, do nothing.

ENV VARS

- SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD (required only when no
  SUPER_ADMIN exists)
- SUPER_ADMIN_FIRST_NAME, SUPER_ADMIN_LAST_NAME (optional, defaults
  "Super" / "Admin")
- Declare them as optional in the main env schema, because a deployment
  that already has a SUPER_ADMIN must not need them. Validate them inside
  the bootstrap, and only when it needs them.
- Validate email format and reuse the SAME password rules used by the
  admin invite accept schema. Do not write a second password policy.

STARTUP SEQUENCE (two phases)
Phase A - before the server starts listening:

1. Query the credential store: does any credential hold the SUPER_ADMIN
   role? (check "any SUPER_ADMIN exists", not "this email exists")
2. If yes: log one info line (no email, no secrets) and skip everything.
3. If no: validate the env vars. If missing or invalid, abort startup
   with a clear error message that names the problem (for example
   "No SUPER_ADMIN exists and SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
   are not set or invalid"). Non-zero exit. Never print the password
   value.
   Phase B - after the server is listening (so health checks pass and
   user-service has time to come up):
4. Create the SUPER_ADMIN, retrying with exponential backoff (about 5
   attempts, roughly 60 seconds total). If all attempts fail, log the
   error and exit non-zero so the platform restarts the service and
   tries again.

CREATION RULES

- Reuse the existing admin account provisioning path used by invite
  accept: password hashing, credential creation, the HMAC-signed call to
  user-service, the audit log repository. Do not write a second
  implementation. Mirror whatever failure/compensation approach invite
  accept uses, so both flows recover the same way.
- Role is SUPER_ADMIN. Email is marked verified (no OTP). Audit log entry
  with actor "system" and a clear action name. Never log the password or
  its hash.
- Convention: the route decides the role, never a payload field. If
  user-service's /admins/profile creates only ADMIN today, add the
  smallest change that lets it create a SUPER_ADMIN profile while keeping
  that convention (for example one dedicated internal route such as
  /admins/super-admin-profile, using the same provisioning function).
  Before coding, state in one paragraph which option you chose and why,
  then proceed. If you add an internal route, also add it to the
  api-gateway internal-only block list and confirm it is blocked.
- If a credential already exists for SUPER_ADMIN_EMAIL:
  - with role SUPER_ADMIN: treat it as the existing super admin and
    only make sure the user-service profile exists (idempotent retry
    of the profile call with the same id).
  - as a customer, seller, or plain ADMIN: do NOT convert it. Abort
    with a clear error (admin identities never hold customer/seller
    roles, and invites only create ADMIN).
- Partial failure must converge on retry: if the credential was created
  but the user-service profile was not, the next run finishes the job
  with the same id, with no duplicates and no orphans. Report exactly
  which partial states are possible and how each one recovers.
- Multiple instances booting at the same time: rely on the unique email
  constraint. A unique-violation means another instance already created
  it; re-check and exit successfully. Do not add distributed locks.
- Invite creation must remain ADMIN-only. Confirm there is no way to mint
  a SUPER_ADMIN through the invite flow and add a test for it.

OUT OF SCOPE (do not build)
Forced password change on first login, password rotation, a CLI, a
first-run web setup page, background re-sync jobs.

DOCS

- Add the new env vars to .env.example with a comment.
- Add a short ADR in the existing ADR directory (docs/adr): context,
  decision (env-var bootstrap, conditional validation, two phases),
  alternatives considered (CLI command, first-run setup page) and why they
  were rejected, and the operational note that SUPER_ADMIN_PASSWORD can be
  removed from the environment once the account exists, because the
  bootstrap does nothing when a SUPER_ADMIN is present.

TESTS
Use the project test setup and a REAL Postgres for DB-backed tests. Fake
user-service at the HTTP boundary with a controllable stub. If no real
database is available, write the tests anyway and mark them "written, NOT
run". Never report mocked-DB results as verified behavior.

1. No SUPER_ADMIN, valid env: creates credential + profile call + audit
   entry, role SUPER_ADMIN, email verified; can log in through
   POST /admins/login.
2. SUPER_ADMIN exists: nothing is created or changed, and the env vars
   are not required.
3. No SUPER_ADMIN and env missing or weak password: startup aborts with
   a clear message and no secrets in the output.
4. Email belongs to a customer/seller/admin credential: aborts, nothing
   modified.
5. user-service fails on the first attempts and then succeeds: retries
   and ends with exactly one credential and one profile.
6. Credential created but profile call failed, then rerun: converges
   with the same id and no duplicates.
7. Two bootstraps race: exactly one credential exists afterwards.
8. The invite flow cannot produce SUPER_ADMIN.

VERIFY

- tsc --noEmit clean in auth-service and user-service; pnpm run
  check-types and pnpm run build pass.
- Boot auth-service twice against a real database and report both startup
  logs (first run creates, second run skips).

REPORT FORMAT

1. The design decision for user-service SUPER_ADMIN profile creation.
2. Files added/changed per service.
3. Partial-failure states and how each recovers.
4. Test results (pass/fail/not run) with how to run them.
5. Anything you did not do, and why.
