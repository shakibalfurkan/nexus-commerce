import { Router } from "express";
import { UserRoles } from "../../generated/prisma/enums.js";
import { auth } from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { DeadLetterController } from "./deadLetter.controller.js";
import { DeadLetterValidation } from "./deadLetter.validation.js";

const router: Router = Router();

// All dead-letter administration requires elevated roles — the same guard
// shape used across user-service (ADMIN or SUPER_ADMIN).
router.use(auth(UserRoles.ADMIN, UserRoles.SUPER_ADMIN));

router.get(
  "/dead-letters",
  validateRequest(DeadLetterValidation.listQuery),
  DeadLetterController.listDeadLetters,
);

router.post("/dead-letters/:id/redrive", DeadLetterController.redriveDeadLetter);

export const DeadLetterRoutes = router;
