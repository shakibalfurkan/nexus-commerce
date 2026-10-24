import z from "zod";

/**
 * Shared auth validation primitives + the schemas for the surface-agnostic
 * session routes. Role modules (`customer/`, `seller/`, `admin/`) import these
 * primitives so email/password/OTP rules are defined exactly once.
 */

const emailSchema = z.email().trim().toLowerCase();

/** Applied to NEW passwords only (registration, admin invite accept, reset). */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
  .trim();

const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d+$/, "OTP must contain only digits");

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format");

/**
 * Login only checks password PRESENCE — never re-validates an existing
 * credential against the current password policy, otherwise tightening the
 * policy would lock out every account created under the old one.
 */
const loginValidationSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, "Password is required"),
  }),
});

const requestPasswordResetValidationSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

const verifyPasswordResetValidationSchema = z.object({
  body: z.object({
    resetToken: z.string().min(1, "Reset token is required"),
    newPassword: passwordSchema,
  }),
});

const requestAccountRestoreValidationSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

const verifyAccountRestoreValidationSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
  }),
});

export const AuthValidation = {
  requestAccountRestoreValidationSchema,
  verifyAccountRestoreValidationSchema,
  emailSchema,
  passwordSchema,
  otpSchema,
  phoneSchema,
  loginValidationSchema,
  requestPasswordResetValidationSchema,
  verifyPasswordResetValidationSchema,
};
