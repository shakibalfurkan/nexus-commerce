// ─── Staff-Level Zod Validation Schema ───
// Validates every runtime input defensively using composed Zod schemas.
// Key patterns:
// 1. `z.discriminatedUnion` for role-specific payload validation
// 2. Explicit `max()` bounds on all string fields to prevent storage abuse
// 3. Strict UUID validation for IDs
// 4. Phone number format validation
// 5. Coordinate bounds validation

import { z } from "zod";
import { UserRoles } from "../../generated/prisma/enums.js";

// ─── Shared Primitives ───

const uuidField = z.uuid("Invalid UUID format");
const firstNameField = z
  .string("First name must be a string")
  .min(1, "First name is required")
  .max(100, "First name must not exceed 100 characters");
const lastNameField = z
  .string("Last name must be a string")
  .min(1, "Last name is required")
  .max(100, "Last name must not exceed 100 characters");
const emailField = z
  .email("Invalid email address")
  .max(255, "Email must not exceed 255 characters");
const phoneField = z
  .string("Phone must be a string")
  .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format")
  .optional();
const avatarField = z
  .url("Avatar must be a valid URL")
  .max(2048, "Avatar URL must not exceed 2048 characters")
  .optional();
const dateOfBirthField = z
  .string("Date of birth must be a string")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format")
  .optional();

// ─── Coordinate Validation ───

const coordinatesSchema = z
  .object({
    lat: z
      .number("Latitude must be a number")
      .min(-90, "Latitude must be at least -90")
      .max(90, "Latitude must be at most 90"),
    lng: z
      .number("Longitude must be a number")
      .min(-180, "Longitude must be at least -180")
      .max(180, "Longitude must be at most 180"),
  })
  .strict();

// ─── Shop Address Validation ───

const shopAddressSchema = z
  .object({
    street: z
      .string("Street must be a string")
      .min(1, "Street is required")
      .max(500, "Street must not exceed 500 characters"),
    city: z
      .string("City must be a string")
      .min(1, "City is required")
      .max(100, "City must not exceed 100 characters"),
    state: z
      .string("State must be a string")
      .min(1, "State is required")
      .max(100, "State must not exceed 100 characters"),
    postalCode: z
      .string("Postal code must be a string")
      .min(1, "Postal code is required")
      .max(20, "Postal code must not exceed 20 characters"),
    country: z
      .string("Country must be a string")
      .min(1, "Country is required")
      .max(100, "Country must not exceed 100 characters"),
    coordinates: coordinatesSchema.optional(),
  })
  .strict();

// ─── Role-Specific Payload Schemas ───
// Using discriminated union pattern for type-safe role validation.

const customerPayloadSchema = z.object({
  role: z.literal(UserRoles.CUSTOMER),
  firstName: firstNameField,
  lastName: lastNameField,
  phone: phoneField,
  avatar: avatarField,
  dateOfBirth: dateOfBirthField,
});

const sellerPayloadSchema = z.object({
  role: z.literal(UserRoles.SELLER),
  firstName: firstNameField,
  lastName: lastNameField,
  phone: phoneField,
  avatar: avatarField,
  shopData: z
    .object({
      shopName: z
        .string("Shop name must be a string")
        .min(1, "Shop name is required")
        .max(100, "Shop name must not exceed 100 characters"),
      shopEmail: z
        .email("Invalid shop email address")
        .max(255, "Shop email must not exceed 255 characters"),
      shopPhone: z
        .string("Shop phone must be a string")
        .regex(/^\+?[1-9]\d{6,14}$/, "Invalid shop phone number format"),
      shopAddress: shopAddressSchema,
    })
    .strict(),
});

const adminPayloadSchema = z.object({
  role: z.union([z.literal(UserRoles.ADMIN), z.literal(UserRoles.SUPER_ADMIN)]),
  firstName: firstNameField,
  lastName: lastNameField,
  phone: phoneField,
  avatar: avatarField,
});

// ─── Composed Discriminated Union ───
// The Zod discriminated union ensures that the payload is validated
// against the correct schema based on the `role` field.
// This is type-safe and eliminates the need for manual role checks.

const profilePayloadSchema = z.discriminatedUnion("role", [
  customerPayloadSchema,
  sellerPayloadSchema,
  adminPayloadSchema,
]);

// ─── Main Create User Validation ───

const createUserProfileValidation = z.object({
  body: z.object({
    id: uuidField,
    email: emailField,
    role: z.enum(
      [
        UserRoles.SUPER_ADMIN,
        UserRoles.ADMIN,
        UserRoles.SELLER,
        UserRoles.CUSTOMER,
      ],
      "Invalid user role",
    ),
    // The `profile` field contains role-specific data validated by the
    // discriminated union. The `role` field on the `body` must match
    // the `role` field inside `profile`.
    profile: profilePayloadSchema,
  }),
});

// ─── Update User Validation ───

const updateUserValidation = z.object({
  body: z.object({
    firstName: firstNameField.optional(),
    lastName: lastNameField.optional(),
    phone: phoneField,
    avatar: avatarField,
    dateOfBirth: dateOfBirthField,
  }),
});

// ─── Update Seller Validation ───

const updateSellerValidation = z.object({
  body: z.object({
    firstName: firstNameField.optional(),
    lastName: lastNameField.optional(),
    phone: phoneField,
    avatar: avatarField,
    shopName: z
      .string("Shop name must be a string")
      .min(1, "Shop name is required")
      .max(100, "Shop name must not exceed 100 characters")
      .optional(),
    shopEmail: z.email("Invalid shop email address").optional(),
    shopPhone: z
      .string("Shop phone must be a string")
      .regex(/^\+?[1-9]\d{6,14}$/, "Invalid shop phone number format")
      .optional(),
    shopAddress: shopAddressSchema.optional(),
    stripeConnectId: z.string().optional(),
  }),
});

// ─── Query Parameter Validation ───

const userQueryValidation = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    role: z.enum(UserRoles).optional(),
    isActive: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    search: z.string().max(100).optional(),
  }),
});

// ─── Exports ───

export const UserValidation = {
  createUserProfileValidation,
  updateUserValidation,
  updateSellerValidation,
  userQueryValidation,
};
