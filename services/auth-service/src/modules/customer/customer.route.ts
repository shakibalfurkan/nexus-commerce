import { Router } from "express";
import { rateLimiter } from "../../middlewares/rateLimiter.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { CustomerValidation } from "./customer.validation.js";
import { CustomerController } from "./customer.controller.js";

const router: Router = Router();

router.post(
  "/register-request",
  rateLimiter({
    maxRequests: 5,
    windowSeconds: 300,
    route: "register-request",
  }),
  validateRequest(CustomerValidation.CustomerRegisterRequestSchema),
  CustomerController.CustomerRegisterRequest,
);

export const CustomerRoutes = router;
