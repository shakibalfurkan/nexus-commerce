TASK: Cleanup and audit of user-service and auth-service after the
role-split refactor. No new features. Behavior must not change except
where stated below.

CONTEXT
A mistake was found in your previous work. Auth-service sent a `role`
field in internal profile-provisioning payloads, and user-service
validated it with z.literal(...). But each role already has its own route
(/customers/profile, /sellers/profile, /admins/profile), so the route
decides the role and the field was redundant dead data. I have already
removed it myself. Do not redo it; verify it (Part 1) and then look for
other mistakes of the same kind (Part 5).
Convention going forward: the route decides the role, never a payload field.
Project conventions to follow: src/lib for instantiated clients,
src/config for plain config, src/repositories for data access (camelCase
file names, imported as namespaces), shared auth logic in modules/auth
(auth-service), role-specific code in its own role module.
Module rule: a feature lives entirely in ONE module (route, controller,
validation, service). Role modules (customer, seller, admin) never import
each other's internals. Anything two modules need goes in src/repositories,
src/lib, or a shared module, not in a sibling role module.

PART 1 - VERIFY THE ROLE REMOVAL

- Confirm no `role` field remains in: auth-service userServiceClient
  payloads/types, user-service provisioning schemas (customer, seller,
  admin), their input types/DTOs, and any tests/docs/ADRs.
- Confirm the role for each provisioning call is set only from the route's
  handler (UserRoles.CUSTOMER / SELLER / ADMIN), not read from the request.
- Report anything left over.

PART 2 - DEAD-LETTER CONSOLIDATION (user-service)
I want modules/dead-letter-event to own everything about dead letters.
Currently the HTTP layer sits in modules/admin
(adminDeadLetter.controller.ts, adminDeadLetter.validation.ts, plus route
declarations in admin.route.ts). Move it back:
modules/dead-letter-event/
deadLetter.route.ts (router, router-level auth(ADMIN, SUPER_ADMIN))
deadLetter.controller.ts
deadLetter.validation.ts
deadLetterEvent.repository.ts
deadLetterConsumer.ts
startDeadLetterConsumer.ts

- Use the original file names (deadLetter._), not adminDeadLetter._.
- Mount in the global router as its own entry in moduleRoutes at
  "/admins/dead-letters" (module router declares only relative paths:
  GET "/" and POST "/:id/redrive"). Mount it BEFORE the "/admins" entry,
  and confirm AdminRoutes has no router-level middleware that would also
  run for dead-letter requests.
- The modules/admin module must end with zero dead-letter references.
- Public URLs stay exactly the same: GET /admins/dead-letters and
  POST /admins/dead-letters/:id/redrive. No aliases for old paths.

PART 3 - BECOME-SELLER CONSOLIDATION (user-service)
The become-seller feature is currently split: route, controller and
request schema are in modules/customer, but the main service function
(SellerProfileService.becomeSeller) lives in modules/seller, so the
customer controller just forwards to another module. Co-locate the whole
feature in modules/customer:

- Route (POST /customers/me/become-seller, guard auth(UserRoles.CUSTOMER)),
  controller, request validation schema, BecomeSellerInput type, and the
  becomeSeller service function all live in modules/customer, added to the
  module's existing files and naming style (do not create extra layers).
- Database access stays where it already is: shared UserRepository
  functions, prisma.$transaction in the service, emitDomainEvent. If any
  function this flow needs currently lives inside modules/seller instead
  of src/repositories, move it to src/repositories. Do not import from
  modules/seller.
- If the seller provisioning schema (/sellers/profile) and the become-seller
  schema share field definitions (firstName, lastName, phone, bio), reuse
  the shared field primitives. Do not duplicate them and do not import them
  from the seller module.
- Delete the old becomeSeller service function, controller method and
  schema from modules/seller after confirming nothing else uses them.
  Seller module keeps only seller-profile provisioning (/sellers/profile).
  No re-exports, no forwarding functions.
- Behavior must be identical: same checks in the same order (user exists,
  admin identities rejected, existing seller conflict), same transaction
  contents (create seller profile, add SELLER role, audit log, outbox
  event user.seller.profile.attached with the same payload), same cache
  invalidation, same response.
- Out of scope: the role-sync timing between become-seller and
  seller-app login. Do not change it here.

PART 4 - VERIFY MY MANUAL MOVE OF THE AUTH-SERVICE AUDIT LOG WRITER
I moved auditLog.ts out of modules/auth myself. Verify only; do not
redo it:

- It lives in src/repositories (not under modules/) and matches
  credential.ts and adminInvite.ts: namespace-import style, consistent
  function and type names, no leftover "writeAuthAuditLog" style naming
  if the other repositories use plain verbs.
- No import of the old path remains anywhere (grep).
- Every caller inside prisma.$transaction still passes the transaction
  client, so audit entries stay atomic with the business write.
- Written fields are unchanged.
  Report anything that does not match and fix it if it is a pure rename or
  import fix.

PART 5 - AUDIT FOR SIMILAR MISTAKES (user-service, auth-service,
api-gateway; do not touch other packages except to fix path references)
Look for:
a. Redundant data: payload/DTO/schema fields that are sent or validated
but never read, or fields whose value is fully determined by the
route or by context.
b. Dead code: unused exports, files, types, schemas, constants, env vars,
dependencies, functions left over from the old all-in-one flow
(anything named create-profile, register-request, role-branching
leftovers).
c. Duplication: two implementations of the same logic (OTP, token,
profile attach, validation helpers).
d. Wrong placement: files not matching the conventions above. In
particular: shared helpers that only do data access but live in a
module folder, and role-specific routes under a generic prefix.
e. Stale references: comments, docs, ADRs, and tests that mention old
paths or old structure.
f. Pass-through layers and cross-module coupling: functions or files
that only forward to another function with no logic of their own, a
role module importing another role module's internals, or one
feature spread across two modules (same mistake as become-seller).
Normal controller -> service -> repository layering is fine; do not
flag it.
Run `npx knip` once for unused files/exports/deps (do not add it to the
project), and `tsc --noEmit` with noUnusedLocals/noUnusedParameters
temporarily enabled to catch unused code. Treat tool output as a lead,
not as truth; confirm each finding by reading the code.

HOW TO ACT ON FINDINGS

- Fix directly: clearly dead code, unused exports/files, stale
  comments/docs, and wrong file placement with no behavior change.
- Do NOT change without asking: database schema or migrations, event
  contracts, HMAC/auth behavior, anything that alters runtime behavior.
  List these in the report with your recommendation.
- Do not add abstractions, new libraries, or compatibility shims.

PART 6 - VERIFY

- tsc --noEmit clean in user-service, auth-service, api-gateway.
- pnpm run check-types and pnpm run build pass.
- Re-probe routes over real HTTP against createApp(): the dead-letter
  routes and POST /customers/me/become-seller reach their handlers (401
  without a token), old /admin/dead-letters returns 404, and all earlier
  route-table results are unchanged.
- Grep to confirm modules/customer has no imports from modules/seller
  (and the reverse).

REPORT FORMAT

1. Part 1 result (clean / leftovers).
2. Final user-service route table, dead-letter file layout, and the final
   file lists of modules/customer and modules/seller.
3. Part 4 result (matches / what was fixed).
4. Findings table: file, issue, category (a-f), action taken or
   recommended, risk.
5. Anything you chose not to change, and why.
