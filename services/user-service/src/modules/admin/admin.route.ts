import { Router } from "express";
import { AdminProfileController } from "./admin.controller.js";
import { AdminProfileValidation } from "./admin.validation.js";
import verifyInternalCall from "../../middlewares/verifyInternalCall.js";
import validateRequest from "../../middlewares/validateRequest.js";

/**
 * Admin module surface — mounted at `/admins`.
 *   POST /profile  internal (HMAC) account provisioning
 */
const router: Router = Router();

router.post(
  "/profile",
  verifyInternalCall,
  validateRequest(AdminProfileValidation.provisioningSchema),
  AdminProfileController.createAdminProfile,
);

router.post(
  "/super-admin-profile",
  verifyInternalCall,
  validateRequest(AdminProfileValidation.provisioningSchema),
  AdminProfileController.createSuperAdminProfile,
);

export const AdminRoutes = router;
