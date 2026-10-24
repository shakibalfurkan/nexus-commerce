import z from "zod";
import { AuthValidation } from "../auth/auth.validation.js";

const SellerRegisterRequestSchema = z.object({
  body: z
    .object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      email: AuthValidation.emailSchema,
      password: AuthValidation.passwordSchema,
      confirmPassword: z.string().min(1, "Please confirm your password"),
      phone: AuthValidation.phoneSchema.optional(),
      bio: z.string().max(500, "Bio must not exceed 500 characters").optional(),
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

export const SellerValidation = {
  SellerRegisterRequestSchema,
  verifyRegistrationSchema,
  resendOtpSchema,
};
