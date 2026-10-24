import { Router } from "express";
import { DeadLetterController } from "./deadLetter.controller.js";
import { DeadLetterValidation } from "./deadLetter.validation.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { auth } from "../../middlewares/auth.js";
import { UserRoles } from "../../generated/prisma/enums.js";

/**
 * Dead-letter administration — mounted at `/dead-letters`.
 * Declares only relative paths; the prefix is owned by the global router.
 */
const router: Router = Router();

router.use(auth(UserRoles.ADMIN, UserRoles.SUPER_ADMIN));

router.get(
  "/",
  validateRequest(DeadLetterValidation.listQuery),
  DeadLetterController.listDeadLetters,
);

router.post("/:id/redrive", DeadLetterController.redriveDeadLetter);

export const DeadLetterRoutes = router;
