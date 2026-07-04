// ─── Staff-Level Route Definitions ───
// Clean separation: Routes define the HTTP contract (method + path + middleware stack).
// No business logic. No data access. Just wiring.

import { Router } from "express";
import { UserController } from "./user.controller.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { UserValidation } from "./user.validation.js";
import verifyInternalCall from "../../middlewares/verifyInternalCall.js";

const router: Router = Router();

// ─── Internal Service Routes (auth-service calls these) ───

/**
 * POST /api/v1/users/create-profile
 * Creates a new user with role-specific profile.
 * Protected by internal service authentication.
 * Body validated by Zod discriminated union for role-specific payloads.
 */
router.post(
  "/create-profile",
  verifyInternalCall,
  validateRequest(UserValidation.createUserProfileValidation),
  UserController.createUserProfile,
);

// ─── User Query Routes ───
// IMPORTANT: Static routes (email) MUST be defined before parameterized routes (:id)
// to avoid Express matching "email" as a parameter value.

/**
 * GET /api/v1/users/email/:email
 * Retrieves a user by their email address.
 */
router.get("/email/:email", UserController.getUserByEmail);

/**
 * GET /api/v1/users/:id
 * Retrieves a user by their UUID.
 */
router.get("/:id", UserController.getUserById);

// ─── User Management Routes ───
// IMPORTANT: Static sub-routes (:id/hard, :id/restore) work correctly after :id
// because Express routes match left-to-right and :id is consumed first.

/**
 * DELETE /api/v1/users/:id
 * Soft-deletes a user (isDeleted = true).
 */
router.delete("/:id", UserController.deleteUser);

/**
 * DELETE /api/v1/users/:id/hard
 * Permanently deletes a user (GDPR Right to Erasure).
 * WARNING: Should only be called after cryptographic shredding.
 */
router.delete("/:id/hard", UserController.hardDeleteUser);

/**
 * POST /api/v1/users/:id/restore
 * Restores a soft-deleted user.
 */
router.post("/:id/restore", UserController.restoreUser);

export const UserRoutes = router;
