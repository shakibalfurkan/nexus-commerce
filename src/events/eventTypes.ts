import { z } from "zod";
import { UserRoles } from "../generated/prisma/enums.js";

// ─── Event Name Constants ───
export const DomainEventTypes = {
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

export const CommandTypes = {
  GENERATE_PDF_INVOICE: "generate.pdf_invoice",
  SYNC_USER_TO_CRM: "sync.user_to_crm",
} as const;

export const NotificationTypes = {
  EMAIL_SEND_WELCOME: "email.send_welcome",
  SMS_SEND_OTP: "sms.send_otp",
} as const;

export const DLQEventTypes = {
  DEAD_LETTER_EVENT: "dead_letter.event",
} as const;

export type DomainEventType =
  (typeof DomainEventTypes)[keyof typeof DomainEventTypes];

// ─── Event Payload Schemas (Zod-validated) ───

export const UserCreatedEventSchema = z.object({
  eventName: z.literal(DomainEventTypes.USER_REGISTERED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.uuid(),
    email: z.email(),
    role: z.enum(UserRoles),
    firstName: z.string(),
    lastName: z.string(),
    createdAt: z.iso.datetime(),
  }),
  metadata: z.object({
    emittedAt: z.iso.datetime(),
    source: z.string().default("user-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;

export const UserDeletedEventSchema = z.object({
  eventName: z.literal(DomainEventTypes.USER_DELETED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.uuid(),
    deletedAt: z.iso.datetime(),
  }),
  metadata: z.object({
    emittedAt: z.iso.datetime(),
    source: z.string().default("user-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type UserDeletedEvent = z.infer<typeof UserDeletedEventSchema>;

export const UserHardDeletedEventSchema = z.object({
  eventName: z.literal(DomainEventTypes.USER_HARD_DELETED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.uuid(),
    deletedAt: z.iso.datetime(),
  }),
  metadata: z.object({
    emittedAt: z.iso.datetime(),
    source: z.string().default("user-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type UserHardDeletedEvent = z.infer<typeof UserHardDeletedEventSchema>;

export const UserRestoredEventSchema = z.object({
  eventName: z.literal(DomainEventTypes.USER_RESTORED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.uuid(),
    restoredAt: z.iso.datetime(),
  }),
  metadata: z.object({
    emittedAt: z.iso.datetime(),
    source: z.string().default("user-service"),
    version: z.number().int().positive().default(1),
  }),
});

export type UserRestoredEvent = z.infer<typeof UserRestoredEventSchema>;

// ─── Union Type for All Domain Events ───
// This is the discriminated union used by the outbox writer.
// Zod validates the event at the point of emission.

export const DomainEventSchema = z.discriminatedUnion("eventName", [
  UserCreatedEventSchema,
  UserDeletedEventSchema,
  UserHardDeletedEventSchema,
  UserRestoredEventSchema,
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;

// ─── Helper to create event metadata ───

export function createEventMetadata(): {
  emittedAt: string;
  source: string;
  version: number;
} {
  return {
    emittedAt: new Date().toISOString(),
    source: "user-service",
    version: 1,
  };
}
