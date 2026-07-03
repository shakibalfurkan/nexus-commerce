import z from "zod";
import { UserRoles } from "../../generated/prisma/enums.js";

export const shopAddressValidationSchema = z.object({
  street: z.string("Street must be a string").min(1, "Street is required"),
  city: z.string("City must be a string").min(1, "City is required"),
  state: z.string("State must be a string").min(1, "State is required"),
  postalCode: z
    .string("Postal code must be a string")
    .min(1, "Postal code is required"),
  country: z.string("Country must be a string").min(1, "Country is required"),
  coordinates: z
    .object({
      lat: z
        .number("Latitude must be a number")
        .refine((val) => val >= -90 && val <= 90, {
          message: "Latitude must be between -90 and 90",
        }),
      lng: z
        .number("Longitude must be a number")
        .refine((val) => val >= -180 && val <= 180, {
          message: "Longitude must be between -180 and 180",
        }),
    })
    .optional(),
});

const createUserProfileValidation = z.object({
  body: z.object({
    id: z.uuid("Invalid user ID format").min(1, "User ID is required"),
    firstName: z
      .string("First name must be a string")
      .min(1, "First name is required"),
    lastName: z
      .string("Last name must be a string")
      .min(1, "Last name is required"),
    email: z.email("Invalid email address").min(1, "Email is required"),
    role: z.enum(
      [
        UserRoles.SUPER_ADMIN,
        UserRoles.ADMIN,
        UserRoles.SELLER,
        UserRoles.CUSTOMER,
      ],
      "Invalid user role",
    ),
    shopData: z
      .object({
        shopName: z
          .string("Shop name must be a string")
          .min(1, "Shop name is required"),
        shopEmail: z
          .email("Invalid shop email address")
          .min(1, "Shop email is required"),
        shopPhone: z
          .string("Shop phone must be a string")
          .min(7, "Shop phone must be at least 7 digits")
          .max(15, "Shop phone must be less than 15 digits"),
        shopAddress: shopAddressValidationSchema,
      })
      .optional(),
  }),
});

export const UserValidation = {
  createUserProfileValidation,
};
