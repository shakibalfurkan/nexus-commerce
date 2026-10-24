import { Router } from "express";
import { SellerController } from "./seller.controller.js";
import { SellerValidation } from "./seller.validation.js";
import { AuthValidation } from "../auth/auth.validation.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { rateLimiter } from "../../middlewares/rateLimiter.js";

/**
 * Seller-app surface — mounted at `/sellers`, same shape as the customer
 * surface: registration (OTP verified) and login.
 */
const router: Router = Router();

router.post(
  "/register",
  rateLimiter({
    maxRequests: 5,
    windowSeconds: 300,
    route: "register-seller",
  }),
  validateRequest(SellerValidation.SellerRegisterRequestSchema),
  SellerController.registerSeller,
);

router.post(
  "/register/verify",
  rateLimiter({
    maxRequests: 10,
    windowSeconds: 300,
    route: "register-seller-verify",
  }),
  validateRequest(SellerValidation.verifyRegistrationSchema),
  SellerController.verifySellerRegistration,
);

router.post(
  "/register/resend-otp",
  rateLimiter({
    maxRequests: 3,
    windowSeconds: 300,
    route: "register-seller-resend-otp",
  }),
  validateRequest(SellerValidation.resendOtpSchema),
  SellerController.resendSellerOtp,
);

router.post(
  "/login",
  rateLimiter({
    maxRequests: 5,
    windowSeconds: 60,
    route: "login-seller-app",
  }),
  validateRequest(AuthValidation.loginValidationSchema),
  SellerController.loginSellerApp,
);

export const SellerRoutes = router;
