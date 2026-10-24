import { z } from "zod";
import {
  emailField,
  firstNameField,
  lastNameField,
  phoneField,
  uuidField,
} from "../user/profileFields.js";

const provisioningSchema = z.object({
  body: z.object({
    id: uuidField,
    email: emailField,
    profile: z.object({
      firstName: firstNameField,
      lastName: lastNameField,
      phone: phoneField.optional(),
    }),
  }),
});

export const AdminProfileValidation = {
  provisioningSchema,
};
