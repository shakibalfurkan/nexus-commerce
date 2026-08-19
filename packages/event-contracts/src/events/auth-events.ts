import { z } from "zod";
import { EventMetadataSchema, type EventMetadata } from "../envelope.js";

/**
 * auth-service produced domain events.
 *
 * Payload shapes are copied verbatim from the prior auth-service
 * `eventTypes.ts` (the live wire contracts) — only the import path changes.
 * `seller.profile.created` / `customer.profile.created` were DEFINED but never
 * EMITTED (no producer code); per the consolidation decision they are dropped
 * entirely rather than shipped as dead schemas.
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
    firstName: z.string(),
    email: z.string(),
    otp: z.string(),
  }),
  metadata: EventMetadataSchema,
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
  metadata: EventMetadataSchema,
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
  metadata: EventMetadataSchema,
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
  metadata: EventMetadataSchema,
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

// Re-export for convenience so services that import metadata helpers don't
// reach into ../envelope.
export type { EventMetadata };
