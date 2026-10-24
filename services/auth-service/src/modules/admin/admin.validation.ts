import z from "zod";
import { AuthValidation } from "../auth/auth.validation.js";

const inviteCreationSchema = z.object({
  body: z.object({
    email: AuthValidation.emailSchema,
  }),
});

/**
 * Invite acceptance: the invitee sets their own password and profile name.
 * The email comes from the invite record, never from the request body.
 */
const inviteAcceptSchema = z.object({
  body: z.object({
    password: AuthValidation.passwordSchema,
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: AuthValidation.phoneSchema.optional(),
  }),
});

export const AdminValidation = {
  inviteCreationSchema,
  inviteAcceptSchema,
};
