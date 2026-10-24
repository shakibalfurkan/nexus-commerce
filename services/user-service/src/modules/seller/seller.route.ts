import { Router } from "express";
import { SellerProfileController } from "./seller.controller.js";
import { SellerProfileValidation } from "./seller.validation.js";
import verifyInternalCall from "../../middlewares/verifyInternalCall.js";
import validateRequest from "../../middlewares/validateRequest.js";

/**
 * Seller module surface — mounted at `/sellers`.
 *   POST /profile  internal (HMAC-signed) account provisioning
 *
 * The seller-profile attach for an existing customer account is owned by the
 * customer module (`POST /customers/me/become-seller`).
 */
const router: Router = Router();

router.post(
  "/profile",
  verifyInternalCall,
  validateRequest(SellerProfileValidation.provisioningSchema),
  SellerProfileController.createSellerProfile,
);

export const SellerRoutes = router;
