import { Router } from "express";
import { UserController } from "./user.controller.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { UserValidation } from "./user.validation.js";
import verifyInternalCall from "../../middlewares/verifyInternalCall.js";

const router: Router = Router();

// ─── Internal Service Routes───
router.post(
  "/create-profile",
  verifyInternalCall,
  validateRequest(UserValidation.createUserProfileValidation),
  UserController.createUserProfile,
);

// ─── User Query Routes ───

router.get("/email/:email", UserController.getUserByEmail);

router.get("/:id", UserController.getUserById);

// ─── User Management Routes ───

router.delete("/:id", UserController.deleteUser);

router.delete("/:id/hard", UserController.hardDeleteUser);

router.post("/:id/restore", UserController.restoreUser);

export const UserRoutes = router;
