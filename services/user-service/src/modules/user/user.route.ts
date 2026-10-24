import { Router } from "express";
import { UserController } from "./user.controller.js";
import { auth } from "../../middlewares/auth.js";
import verifyInternalCall from "../../middlewares/verifyInternalCall.js";
import { UserRoles } from "../../generated/prisma/enums.js";

const router: Router = Router();

// Internal-only (HMAC): email lookup
router.get("/email/:email", verifyInternalCall, UserController.getUserByEmail);

// Owner self-service (JWT)
router.get("/me", auth(), UserController.getUserMe);
router.delete("/me", auth(), UserController.deleteMe);

// Admin-only by id
router.get("/:id", auth(UserRoles.ADMIN, UserRoles.SUPER_ADMIN), UserController.getUserById);
router.delete("/:id", auth(UserRoles.ADMIN, UserRoles.SUPER_ADMIN), UserController.deleteUser);
router.delete("/:id/hard", auth(UserRoles.SUPER_ADMIN), UserController.hardDeleteUser);

// Internal-only restore (HMAC) with grace check in service
router.post("/:id/restore", verifyInternalCall, UserController.restoreUser);

export const UserRoutes = router;
