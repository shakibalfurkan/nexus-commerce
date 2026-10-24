import { Router } from "express";
import { AdminController } from "./admin.controller.js";
import { AdminValidation } from "./admin.validation.js";
import { AuthValidation } from "../auth/auth.validation.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { rateLimiter } from "../../middlewares/rateLimiter.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import { UserRoles } from "../../generated/prisma/enums.js";

/**
 * Admin surface — mounted at `/admins`.
 *
 * There is deliberately NO registration route: an ADMIN account is only ever
 * created by consuming an invite. Invite creation is guarded at the route level
 * (`SUPER_ADMIN`), not merely hidden in a UI — an ordinary ADMIN holding a valid
 * session is rejected by `requireRole`.
 */
const router: Router = Router();

// Stricter than the customer/seller surfaces (3 attempts per 5 minutes).
router.post(
  "/login",
  rateLimiter({
    maxRequests: 3,
    windowSeconds: 300,
    route: "login-admin",
  }),
  validateRequest(AuthValidation.loginValidationSchema),
  AdminController.loginAdmin,
);

router.post(
  "/invites",
  rateLimiter({
    maxRequests: 10,
    windowSeconds: 300,
    route: "admin-invite-create",
  }),
  authenticate,
  requireRole(UserRoles.SUPER_ADMIN),
  validateRequest(AdminValidation.inviteCreationSchema),
  AdminController.createInvite,
);

// Public: the invitee has no account yet, so this is rate-limited instead of
// authenticated. It only reports invite state.
router.get(
  "/invites/:token",
  rateLimiter({
    maxRequests: 20,
    windowSeconds: 300,
    route: "admin-invite-validate",
  }),
  AdminController.validateInvite,
);

router.post(
  "/invites/:token/accept",
  rateLimiter({
    maxRequests: 5,
    windowSeconds: 300,
    route: "admin-invite-accept",
  }),
  validateRequest(AdminValidation.inviteAcceptSchema),
  AdminController.acceptInvite,
);

export const AdminRoutes = router;
