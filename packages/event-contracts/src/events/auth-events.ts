import { z } from "zod";


/**
 * auth-service produced domain events.
 */

export const AuthDomainEventTypes = {
  EMAIL_VERIFICATION_OTP_SENT: "email.verification.otp.sent",
  PASSWORD_RESET_REQUESTED: "password.reset.requested",
  SELLER_PROFILE_REQUESTED: "seller.profile.requested",
  CUSTOMER_PROFILE_REQUESTED: "customer.profile.requested",
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

export const AuthDomainEventSchema = z.discriminatedUnion("eventType", [
  EmailVerificationOtpEventSchema,
  PasswordResetRequestedEventSchema,
  SellerProfileRequestedEventSchema,
  CustomerProfileRequestedEventSchema,
]);

export type TAuthDomainEvent = z.infer<typeof AuthDomainEventSchema>;


