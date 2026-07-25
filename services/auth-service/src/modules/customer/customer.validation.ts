import z from "zod";

const emailSchema = z.email().trim().toLowerCase();

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
  .trim();

const CustomerRegisterRequestSchema = z.object({
  body: z
    .object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      email: emailSchema,
      password: passwordSchema,
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

export const CustomerValidation = {
  CustomerRegisterRequestSchema,
};
