import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { AuthValidation } from "./auth.validation.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { rateLimiter } from "../../middlewares/rateLimiter.js";

/**
 * Session-level routes shared by every surface — mounted at `/auth`.
 * Registration and login live with their role modules (`customer/`, `seller/`,
 * `admin/`) because they differ by client surface.
 */
const router: Router = Router();

router.post("/refresh-token", AuthController.refreshToken);

router.post("/logout", AuthController.logout);

router.post(
  "/forgot-password",
  rateLimiter({
    maxRequests: 3,
    windowSeconds: 300,
    route: "forgot-password",
  }),
  validateRequest(AuthValidation.requestPasswordResetValidationSchema),
  AuthController.requestPasswordReset,
);

router.post(
  "/reset-password",
  rateLimiter({
    maxRequests: 3,
    windowSeconds: 300,
    route: "reset-password",
  }),
  validateRequest(AuthValidation.verifyPasswordResetValidationSchema),
  AuthController.verifyPasswordReset,
);

router.post(
  "/restore/request",
  rateLimiter({ maxRequests: 3, windowSeconds: 300, route: "account-restore" }),
  validateRequest(AuthValidation.requestAccountRestoreValidationSchema),
  AuthController.requestAccountRestore,
);

router.post(
  "/restore/verify",
  rateLimiter({ maxRequests: 3, windowSeconds: 300, route: "account-restore-verify" }),
  validateRequest(AuthValidation.verifyAccountRestoreValidationSchema),
  AuthController.verifyAccountRestore,
);

export const AuthRoutes = router;
