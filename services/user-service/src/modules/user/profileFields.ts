import { z } from "zod";

/**
 * Shared field primitives for every role's profile payload. Each role module
 * composes its own schema from these, so bounds (max lengths, phone format,
 * coordinate ranges) are defined exactly once.
 */

export const uuidField = z.uuid("Invalid UUID format");

export const emailField = z
  .email("Invalid email address")
  .max(255, "Email must not exceed 255 characters");

export const firstNameField = z
  .string("First name must be a string")
  .min(1, "First name is required")
  .max(100, "First name must not exceed 100 characters");

export const lastNameField = z
  .string("Last name must be a string")
  .min(1, "Last name is required")
  .max(100, "Last name must not exceed 100 characters");

export const phoneField = z
  .string("Phone must be a string")
  .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format");

export const avatarField = z
  .url("Avatar must be a valid URL")
  .max(2048, "Avatar URL must not exceed 2048 characters");

export const dateOfBirthField = z
  .string("Date of birth must be a string")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format");

export const bioField = z
  .string("Bio must be a string")
  .max(500, "Bio must not exceed 500 characters");
