import { Router } from "express";
import { UserRoles } from "../../generated/prisma/enums.js";
import { CustomerProfileController } from "./customer.controller.js";
import { CustomerProfileValidation } from "./customer.validation.js";
import verifyInternalCall from "../../middlewares/verifyInternalCall.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { auth } from "../../middlewares/auth.js";

/**
 * Customer module surface — mounted at `/customers`.
 *   POST /profile          internal (HMAC-signed) account provisioning
 *   POST /me/become-seller authenticated customer attaching a seller profile
 */
const router: Router = Router();

router.post(
  "/profile",
  verifyInternalCall,
  validateRequest(CustomerProfileValidation.provisioningSchema),
  CustomerProfileController.createCustomerProfile,
);

/**
 * Dual-role attachment: only an authenticated CUSTOMER (a customer-app session)
 * can turn their own account into a seller one. Ownership comes from the token,
 * never from the body.
 */
router.post(
  "/me/become-seller",
  auth(UserRoles.CUSTOMER),
  validateRequest(CustomerProfileValidation.becomeSellerSchema),
  CustomerProfileController.becomeSeller,
);

export const CustomerRoutes = router;
