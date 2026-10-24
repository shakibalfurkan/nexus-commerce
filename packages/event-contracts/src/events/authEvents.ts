import { z } from "zod";

/**
 * auth-service produced domain events.
 */

export const AuthDomainEventTypes = {
  EMAIL_VERIFICATION_OTP_SENT: "email.verification.otp.sent",
  PASSWORD_RESET_REQUESTED: "password.reset.requested",
  SELLER_PROFILE_REQUESTED: "seller.profile.requested",
  CUSTOMER_PROFILE_REQUESTED: "customer.profile.requested",
  ADMIN_INVITE_CREATED: "admin.invite.created",
  ACCOUNT_RESTORE_REQUESTED: "account.restore.requested",
} as const;

export type TAuthDomainEventType =
  (typeof AuthDomainEventTypes)[keyof typeof AuthDomainEventTypes];

export const EmailVerificationOtpEventSchema = z.object({
  eventType: z.literal(AuthDomainEventTypes.EMAIL_VERIFICATION_OTP_SENT),
  aggregateId: z.uuid(),
  payload: z.object({
    email: z.string(),
    otp: z.string(),
  }),
});

export type EmailVerificationOtpEvent = z.infer<
  typeof EmailVerificationOtpEventSchema
>;

export const PasswordResetRequestedEventSchema = z.object({
  eventType: z.literal(AuthDomainEventTypes.PASSWORD_RESET_REQUESTED),
  aggregateId: z.uuid(),
  payload: z.object({
    email: z.string(),
    resetUiLink: z.string(),
  }),
});

export type PasswordResetRequestedEvent = z.infer<
  typeof PasswordResetRequestedEventSchema
>;

export const SellerProfileRequestedEventSchema = z.object({
  eventType: z.literal(AuthDomainEventTypes.SELLER_PROFILE_REQUESTED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.string(),
    requestedRole: z.literal("SELLER"),
  }),
});

export type SellerProfileRequestedEvent = z.infer<
  typeof SellerProfileRequestedEventSchema
>;

export const CustomerProfileRequestedEventSchema = z.object({
  eventType: z.literal(AuthDomainEventTypes.CUSTOMER_PROFILE_REQUESTED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.string(),
    requestedRole: z.literal("CUSTOMER"),
  }),
});

export type CustomerProfileRequestedEvent = z.infer<
  typeof CustomerProfileRequestedEventSchema
>;

/**
 * Super-admin created an admin invite. Consumed by notification-service only —
 * the invite link (and therefore the single-use token) travels in this payload
 * exactly like the password-reset link does.
 */
export const AdminInviteCreatedEventSchema = z.object({
  eventType: z.literal(AuthDomainEventTypes.ADMIN_INVITE_CREATED),
  aggregateId: z.uuid(),
  payload: z.object({
    email: z.string(),
    inviteLink: z.string(),
    expiresAt: z.iso.datetime(),
  }),
});

export type AdminInviteCreatedEvent = z.infer<
  typeof AdminInviteCreatedEventSchema
>;

export const AccountRestoreRequestedEventSchema = z.object({
  eventType: z.literal(AuthDomainEventTypes.ACCOUNT_RESTORE_REQUESTED),
  aggregateId: z.uuid(),
  payload: z.object({
    email: z.string(),
    otp: z.string(),
  }),
});

export type AccountRestoreRequestedEvent = z.infer<
  typeof AccountRestoreRequestedEventSchema
>;

export const AuthDomainEventSchema = z.discriminatedUnion("eventType", [
  EmailVerificationOtpEventSchema,
  PasswordResetRequestedEventSchema,
  SellerProfileRequestedEventSchema,
  CustomerProfileRequestedEventSchema,
  AdminInviteCreatedEventSchema,
  AccountRestoreRequestedEventSchema,
]);

export type TAuthDomainEvent = z.infer<typeof AuthDomainEventSchema>;
