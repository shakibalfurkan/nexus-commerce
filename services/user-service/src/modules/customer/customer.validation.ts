import { z } from "zod";
import {
  avatarField,
  bioField,
  dateOfBirthField,
  emailField,
  firstNameField,
  lastNameField,
  phoneField,
  uuidField,
} from "../user/profileFields.js";

/** Internal: full account provisioning for a brand-new customer. */
const provisioningSchema = z.object({
  body: z.object({
    id: uuidField,
    email: emailField,
    profile: z.object({
      firstName: firstNameField,
      lastName: lastNameField,
      phone: phoneField.optional(),
      avatar: avatarField.optional(),
      dateOfBirth: dateOfBirthField.optional(),
    }),
  }),
});

/** Self-service: a customer attaches a seller profile to their own account. */
const becomeSellerSchema = z.object({
  body: z.object({
    firstName: firstNameField,
    lastName: lastNameField,
    phone: phoneField.optional(),
    bio: bioField.optional(),
  }),
});

export const CustomerProfileValidation = {
  provisioningSchema,
  becomeSellerSchema,
};
