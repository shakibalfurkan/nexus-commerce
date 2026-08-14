import { z } from "zod";

export const KafkaTopics = {
  DOMAIN_EVENTS: "domain-events",
  DLQ: "dead-letter-queue",
} as const;

// ─── Standard Event Envelope ───

export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  eventVersion: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  producer: z.string(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  traceparent: z.string().optional(),
  payload: z.unknown(),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

// ─── Event Name Constants ───

export const DomainEventTypes = {
  // auth-service events
  EMAIL_VERIFICATION_OTP_SENT: "email.verification.otp.sent",
  PASSWORD_RESET_REQUESTED: "password.reset.requested",
  SELLER_PROFILE_REQUESTED: "seller.profile.requested",
  CUSTOMER_PROFILE_REQUESTED: "customer.profile.requested",
  SELLER_PROFILE_CREATED: "seller.profile.created",
  CUSTOMER_PROFILE_CREATED: "customer.profile.created",
  // user-service events
  USER_REGISTERED: "user.registered",
  USER_DELETED: "user.deleted",
  USER_HARD_DELETED: "user.hard_deleted",
  USER_RESTORED: "user.restored",
  USER_PROFILE_UPDATED: "user.profile_updated",
  USER_PASSWORD_CHANGED: "user.password_changed",
  USER_EMAIL_CHANGED: "user.email_changed",
  USER_ROLE_CHANGED: "user.role_changed",
  USER_LOCKED: "user.locked",
  USER_UNLOCKED: "user.unlocked",
  ORDER_PLACED: "order.placed",
  PAYMENT_SUCCEEDED: "payment.succeeded",
} as const;

export const DLQEventTypes = {
  DEAD_LETTER_EVENT: "dead_letter.event",
} as const;

export type TDomainEventType =
  (typeof DomainEventTypes)[keyof typeof DomainEventTypes];

// ─── Event Payload Schemas (Zod-validated) ───

// auth-service events
export const EmailVerificationOtpEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.EMAIL_VERIFICATION_OTP_SENT),
  producer: z.literal("auth-service"),
  aggregateId: z.uuid(),
  payload: z.object({
    firstName: z.string(),
    email: z.string(),
    otp: z.string(),
  }),
});

export type EmailVerificationOtpEvent = z.infer<
  typeof EmailVerificationOtpEventSchema
>;

export const PasswordResetRequestedEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.PASSWORD_RESET_REQUESTED),
  eventVersion: z.literal(1),
  producer: z.literal("auth-service"),
  payload: z.object({
    email: z.string(),
    resetUiLink: z.string(),
  }),
});

export type PasswordResetRequestedEvent = z.infer<
  typeof PasswordResetRequestedEventSchema
>;

export const SellerProfileRequestedEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.SELLER_PROFILE_REQUESTED),
  eventVersion: z.literal(1),
  producer: z.literal("auth-service"),
  payload: z.object({
    userId: z.string(),
    requestedRole: z.literal("SELLER"),
  }),
});

export type SellerProfileRequestedEvent = z.infer<
  typeof SellerProfileRequestedEventSchema
>;

export const CustomerProfileRequestedEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.CUSTOMER_PROFILE_REQUESTED),
  eventVersion: z.literal(1),
  producer: z.literal("auth-service"),
  payload: z.object({
    userId: z.string(),
    requestedRole: z.literal("CUSTOMER"),
  }),
});

export type CustomerProfileRequestedEvent = z.infer<
  typeof CustomerProfileRequestedEventSchema
>;

export const SellerProfileCreatedEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.SELLER_PROFILE_CREATED),
  eventVersion: z.literal(1),
  producer: z.literal("user-service"),
  payload: z.object({
    userId: z.string(),
    email: z.string(),
    syncedVersion: z.number().int(),
  }),
});

export type SellerProfileCreatedEvent = z.infer<
  typeof SellerProfileCreatedEventSchema
>;

export const CustomerProfileCreatedEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.CUSTOMER_PROFILE_CREATED),
  eventVersion: z.literal(1),
  producer: z.literal("user-service"),
  payload: z.object({
    userId: z.string(),
    email: z.string(),
    syncedVersion: z.number().int(),
  }),
});

export type CustomerProfileCreatedEvent = z.infer<
  typeof CustomerProfileCreatedEventSchema
>;

// user-service events
export const UserCreatedEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.USER_REGISTERED),
  eventVersion: z.literal(1),
  producer: z.literal("user-service"),
  payload: z.object({
    userId: z.string(),
    email: z.string(),
    role: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    createdAt: z.string(),
  }),
});

export type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;

export const UserDeletedEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.USER_DELETED),
  eventVersion: z.literal(1),
  producer: z.literal("user-service"),
  payload: z.object({
    userId: z.string(),
    deletedAt: z.string(),
  }),
});

export type UserDeletedEvent = z.infer<typeof UserDeletedEventSchema>;

export const UserHardDeletedEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.USER_HARD_DELETED),
  eventVersion: z.literal(1),
  producer: z.literal("user-service"),
  payload: z.object({
    userId: z.string(),
    deletedAt: z.string(),
  }),
});

export type UserHardDeletedEvent = z.infer<typeof UserHardDeletedEventSchema>;

export const UserRestoredEventSchema = z.object({
  eventType: z.literal(DomainEventTypes.USER_RESTORED),
  eventVersion: z.literal(1),
  producer: z.literal("user-service"),
  payload: z.object({
    userId: z.string(),
    restoredAt: z.string(),
  }),
});

export type UserRestoredEvent = z.infer<typeof UserRestoredEventSchema>;

// ─── Union Types ───

export const DomainEventSchema = z.discriminatedUnion("eventType", [
  EmailVerificationOtpEventSchema,
  PasswordResetRequestedEventSchema,
  SellerProfileRequestedEventSchema,
  CustomerProfileRequestedEventSchema,
  SellerProfileCreatedEventSchema,
  CustomerProfileCreatedEventSchema,
  UserCreatedEventSchema,
  UserDeletedEventSchema,
  UserHardDeletedEventSchema,
  UserRestoredEventSchema,
]);

export type TDomainEvent = z.infer<typeof DomainEventSchema>;

// ─── Helper to create event envelope ───

export function createEventEnvelope(
  eventType: string,
  producer: string,
  payload: unknown,
  options: {
    eventVersion?: number;
    correlationId?: string;
    causationId?: string;
    traceparent?: string;
  } = {},
): EventEnvelope {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    eventVersion: options.eventVersion ?? 1,
    occurredAt: new Date().toISOString(),
    producer,
    correlationId: options.correlationId,
    causationId: options.causationId,
    traceparent: options.traceparent,
    payload,
  };
}
