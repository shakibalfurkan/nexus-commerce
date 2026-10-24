import { Router } from "express";
import { CustomerController } from "./customer.controller.js";
import { CustomerValidation } from "./customer.validation.js";
import { AuthValidation } from "../auth/auth.validation.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { rateLimiter } from "../../middlewares/rateLimiter.js";

/**
 * Customer-app surface — mounted at `/customers`.
 *
 * The prefix names the surface, so a seller app can never be served by a
 * customer-app endpoint (enforced again by the X-Client-Type guard inside the
 * service).
 */
const router: Router = Router();

router.post(
  "/register",
  rateLimiter({
    maxRequests: 5,
    windowSeconds: 300,
    route: "register-customer",
  }),
  validateRequest(CustomerValidation.CustomerRegisterRequestSchema),
  CustomerController.registerCustomer,
);

router.post(
  "/register/verify",
  rateLimiter({
    maxRequests: 10,
    windowSeconds: 300,
    route: "register-customer-verify",
  }),
  validateRequest(CustomerValidation.verifyRegistrationSchema),
  CustomerController.verifyCustomerRegistration,
);

router.post(
  "/register/resend-otp",
  rateLimiter({
    maxRequests: 3,
    windowSeconds: 300,
    route: "register-customer-resend-otp",
  }),
  validateRequest(CustomerValidation.resendOtpSchema),
  CustomerController.resendCustomerOtp,
);

router.post(
  "/login",
  rateLimiter({
    maxRequests: 5,
    windowSeconds: 60,
    route: "login-customer-app",
  }),
  validateRequest(AuthValidation.loginValidationSchema),
  CustomerController.loginCustomerApp,
);

export const CustomerRoutes = router;
