import { z } from "zod";
import {
  AuthDomainEventTypes,
  UserDomainEventTypes,
} from "@nexus/event-contracts";
/**
 * Wire-accurate Kafka event schemas for the `domain-events` topic.
 *
 * Verified against the actual producers (auth-service / user-service outbox
 * writers). The wire envelope is NOT the `packages/event-contracts` shape:
 *   {
 *     eventType:   "email.verification.otp.sent",
 *     aggregateId: "<per-event-uuid>",        // idempotency key source
 *     payload:     { ... }
 *   }
 *
 * Trace context (`traceparent`) travels in the Kafka message HEADERS, not the
 * JSON body — see each service's `src/config/kafka.ts` + `createEventBus`
 * (header binding in `src/types/kafka-message.types.ts`).
 */



// ─── Domain Event Names ───

export const DomainEventNames = [
  AuthDomainEventTypes.EMAIL_VERIFICATION_OTP_SENT,
  AuthDomainEventTypes.PASSWORD_RESET_REQUESTED,
  UserDomainEventTypes.USER_REGISTERED,
] as const;

/**
 * Keep in sync with the discriminated union below. The registry map acts as
 * the single behavioural mapping (template / downstream type); this enum is
 * only the accepted wire-name set.
 */
export const DomainEventNameSchema = z.enum(DomainEventNames);
export type TDomainEventName = z.infer<typeof DomainEventNameSchema>;

// ─── Individual Event Schemas (payloads intentionally strict — boundary) ───

export const EmailVerificationOtpEventSchema = z.object({
  eventType: z.literal("email.verification.otp.sent"),
  aggregateId: z.uuid(),
  payload: z.object({
    email: z.email(),
    otp: z.string(),
  }),
});

export type EmailVerificationOtpEvent = z.infer<
  typeof EmailVerificationOtpEventSchema
>;

export const PasswordResetRequestedEventSchema = z.object({
  eventType: z.literal("password.reset.requested"),
  aggregateId: z.uuid(),
  payload: z.object({
    email: z.email(),
    resetUiLink: z.string(),
  }),
});

export type PasswordResetRequestedEvent = z.infer<
  typeof PasswordResetRequestedEventSchema
>;

export const UserRegisteredEventSchema = z.object({
  eventType: z.literal("user.registered"),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.uuid(),
    email: z.email(),
    role: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    createdAt: z.iso.datetime(),
  }),
});

export type UserRegisteredEvent = z.infer<typeof UserRegisteredEventSchema>;

// ─── Discriminated Union (Kafka boundary validation) ───

export const DomainEventSchema = z.discriminatedUnion("eventType", [
  EmailVerificationOtpEventSchema,
  PasswordResetRequestedEventSchema,
  UserRegisteredEventSchema,
]);

export type TDomainEvent = z.infer<typeof DomainEventSchema>;

// ─── Event Registry (registry/map over conditional branching —) ───

/**
 * One entry per handled event name. The `extractRecipient` callback is
 * statically narrowed to the exact payload shape for its event, so a typo or
 * missing field is a compile error rather than a runtime surprise.
 */
type TDomainEventRegistry = {
  [K in TDomainEvent["eventType"]]: {
    /** Template filename (no extension) — resolves into src/templates/. */
    templateKey: string;
    extractRecipient: (
      event: Extract<TDomainEvent, { eventType: K }>,
    ) => string;
    /** Email subject line for this event type. */
    getSubject: (event: Extract<TDomainEvent, { eventType: K }>) => string;
  };
};

export const domainEventRegistry = {
  [AuthDomainEventTypes.EMAIL_VERIFICATION_OTP_SENT]: {
    templateKey: "email-verification",
    extractRecipient: (event: EmailVerificationOtpEvent) => event.payload.email,
    getSubject: (event: EmailVerificationOtpEvent) =>
      `Your Nexus verification code is ${event.payload.otp}`,
  },
  [AuthDomainEventTypes.PASSWORD_RESET_REQUESTED]: {
    templateKey: "password-reset",
    extractRecipient: (event: PasswordResetRequestedEvent) =>
      event.payload.email,
    getSubject: () => "Reset your Nexus password",
  },
  [UserDomainEventTypes.USER_REGISTERED]: {
    templateKey: "welcome",
    extractRecipient: (event: UserRegisteredEvent) => event.payload.email,
    getSubject: (event: UserRegisteredEvent) =>
      `Welcome to Nexus, ${event.payload.firstName}!`,
  },
} as const satisfies TDomainEventRegistry;

/**
 * Computed lookup helpers — single, typed accessors the core consumer uses.
 * Unknown event names are rejected at the registry boundary instead of
 * silently falling through scattered `switch` cases.
 */
export function getEventRegistryEntry(
  eventType: TDomainEvent["eventType"],
): (typeof domainEventRegistry)[TDomainEvent["eventType"]] {
  return domainEventRegistry[eventType];
}

export function isHandledDomainEvent(
  eventType: string,
): eventType is TDomainEvent["eventType"] {
  return eventType in domainEventRegistry;
}
