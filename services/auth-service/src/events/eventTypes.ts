import { z } from "zod";
import { UserRoles } from "../generated/prisma/enums.js";

// ─── Event Name Constants ───
export const DomainEventTypes = {
  EMAIL_VERIFICATION_OTP_SENT: "email.verification.otp.sent",
  PASSWORD_RESET_REQUESTED: "password.reset.requested",
  SELLER_PROFILE_REQUESTED: "seller.profile.requested",
  CUSTOMER_PROFILE_REQUESTED: "customer.profile.requested",
  SELLER_PROFILE_CREATED: "seller.profile.created",
  CUSTOMER_PROFILE_CREATED: "customer.profile.created",
} as const;

export const DLQEventTypes = {
  DEAD_LETTER_EVENT: "dead_letter.event",
} as const;

export type TDomainEventType =
  (typeof DomainEventTypes)[keyof typeof DomainEventTypes];

// ─── OtpPurpose Enum ───
export const OtpPurpose = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  LOGIN_2FA: "LOGIN_2FA",
  PASSWORD_RESET_VERIFICATION: "PASSWORD_RESET_VERIFICATION",
} as const;

export type TOtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

// ─── Event Payload Schemas (Zod-validated) ───

const EmailVerificationOtpSchema = z.object({
  eventName: z.literal(DomainEventTypes.EMAIL_VERIFICATION_OTP_SENT),
  aggregateId: z.string(),
  payload: z.object({
    firstName: z.string(),
    email: z.string(),
    otp: z.string(),
  }),
  metadata: z.object({
    emittedAt: z.string(),
    source: z.string().default("auth-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type EmailVerificationOtpEvent = z.infer<
  typeof EmailVerificationOtpSchema
>;

const PasswordResetRequestedSchema = z.object({
  eventName: z.literal(DomainEventTypes.PASSWORD_RESET_REQUESTED),
  aggregateId: z.string(),
  payload: z.object({
    email: z.string(),
    resetUiLink: z.string(),
  }),
  metadata: z.object({
    emittedAt: z.string(),
    source: z.string().default("auth-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type PasswordResetRequestedEvent = z.infer<
  typeof PasswordResetRequestedSchema
>;

const SellerProfileRequestedSchema = z.object({
  eventName: z.literal(DomainEventTypes.SELLER_PROFILE_REQUESTED),
  aggregateId: z.string(),
  payload: z.object({
    userId: z.string(),
    requestedRole: z.literal("SELLER"),
  }),
  metadata: z.object({
    emittedAt: z.string(),
    source: z.string().default("auth-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type SellerProfileRequestedEvent = z.infer<
  typeof SellerProfileRequestedSchema
>;

const CustomerProfileRequestedSchema = z.object({
  eventName: z.literal(DomainEventTypes.CUSTOMER_PROFILE_REQUESTED),
  aggregateId: z.string(),
  payload: z.object({
    userId: z.string(),
    requestedRole: z.literal("CUSTOMER"),
  }),
  metadata: z.object({
    emittedAt: z.string(),
    source: z.string().default("auth-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type CustomerProfileRequestedEvent = z.infer<
  typeof CustomerProfileRequestedSchema
>;

const SellerProfileCreatedSchema = z.object({
  eventName: z.literal(DomainEventTypes.SELLER_PROFILE_CREATED),
  aggregateId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.string(),
    syncedVersion: z.number().int(),
  }),
  metadata: z.object({
    emittedAt: z.string(),
    source: z.string().default("user-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type SellerProfileCreatedEvent = z.infer<
  typeof SellerProfileCreatedSchema
>;

const CustomerProfileCreatedSchema = z.object({
  eventName: z.literal(DomainEventTypes.CUSTOMER_PROFILE_CREATED),
  aggregateId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.string(),
    syncedVersion: z.number().int(),
  }),
  metadata: z.object({
    emittedAt: z.string(),
    source: z.string().default("user-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type CustomerProfileCreatedEvent = z.infer<
  typeof CustomerProfileCreatedSchema
>;

// ─── Union Type for All Domain Events ───
export const DomainEventSchema = z.discriminatedUnion("eventName", [
  EmailVerificationOtpSchema,
  PasswordResetRequestedSchema,
  SellerProfileRequestedSchema,
  CustomerProfileRequestedSchema,
  SellerProfileCreatedSchema,
  CustomerProfileCreatedSchema,
]);

export type TDomainEvent = z.infer<typeof DomainEventSchema>;

// ─── Helper to create event metadata ───

export function createEventMetadata(): {
  emittedAt: string;
  source: string;
  version: number;
} {
  return {
    emittedAt: new Date().toISOString(),
    source: "auth-service",
    version: 1,
  };
}
