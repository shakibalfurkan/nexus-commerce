import z from "zod";
import { AuthValidation } from "../auth/auth.validation.js";

/**
 * Customer-app schemas. Only the fields a customer app collects differ from the
 * seller app — email/password/OTP rules come from the shared auth primitives.
 */

const CustomerRegisterRequestSchema = z.object({
  body: z
    .object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      email: AuthValidation.emailSchema,
      password: AuthValidation.passwordSchema,
      confirmPassword: z.string().min(1, "Please confirm your password"),
      acceptTerms: z.boolean().refine((val) => val === true, {
        message: "You must accept the Terms and Conditions to register",
      }),
      marketingOptIn: z.boolean().optional().default(false),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

const verifyRegistrationSchema = z.object({
  body: z.object({
    email: AuthValidation.emailSchema,
    otp: AuthValidation.otpSchema,
  }),
});

const resendOtpSchema = z.object({
  body: z.object({
    email: AuthValidation.emailSchema,
  }),
});

export const CustomerValidation = {
  CustomerRegisterRequestSchema,
  verifyRegistrationSchema,
  resendOtpSchema,
};
