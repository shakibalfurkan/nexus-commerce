import { z } from "zod";
import {
  bioField,
  emailField,
  firstNameField,
  lastNameField,
  phoneField,
  uuidField,
} from "../user/profileFields.js";

/** Internal: full account provisioning for a brand-new seller. */
const provisioningSchema = z.object({
  body: z.object({
    id: uuidField,
    email: emailField,
    profile: z.object({
      firstName: firstNameField,
      lastName: lastNameField,
      phone: phoneField.optional(),
      bio: bioField.optional(),
    }),
  }),
});

export const SellerProfileValidation = {
  provisioningSchema,
};
