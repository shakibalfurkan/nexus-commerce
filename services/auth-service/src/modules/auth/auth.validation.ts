import z from "zod";

// ─── Shared email schema ───
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

// export const shopAddressValidationSchema = z.object({
//   street: z.string().min(1, "Street is required"),
//   city: z.string().min(1, "City is required"),
//   state: z.string().min(1, "State is required"),
//   postalCode: z.string().min(1, "Postal code is required"),
//   country: z.string().min(1, "Country is required"),
//   coordinates: z
//     .object({
//       lat: z.number().refine((val) => val >= -90 && val <= 90, {
//         message: "Latitude must be between -90 and 90",
//       }),
//       lng: z.number().refine((val) => val >= -180 && val <= 180, {
//         message: "Longitude must be between -180 and 180",
//       }),
//     })
//     .optional(),
//   formattedAddress: z.string().optional(),
// });

const registerRequestValidationSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: emailSchema,
    role: z.enum(["SELLER", "CUSTOMER"]),
    password: passwordSchema,
  }),
});

const verifyRegistrationValidationSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: z
      .string()
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d+$/, "OTP must contain only digits"),
  }),
});

const resendOtpValidationSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

const loginValidationSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["customer", "seller", "admin"]),
  }),
});

const provisionSellerValidationSchema = z.object({
  body: z.object({}),
});

const provisionCustomerValidationSchema = z.object({
  body: z.object({}),
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

export const AuthValidation = {
  registerRequestValidationSchema,
  verifyRegistrationValidationSchema,
  resendOtpValidationSchema,
  loginValidationSchema,
  provisionSellerValidationSchema,
  provisionCustomerValidationSchema,
  requestPasswordResetValidationSchema,
  verifyPasswordResetValidationSchema,
};
