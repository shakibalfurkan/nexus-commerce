import { z } from "zod";

/**
 * user-service produced domain events.
 */

export const UserDomainEventTypes = {
  USER_REGISTERED: "user.registered",
  SELLER_PROFILE_ATTACHED: "user.seller.profile.attached",
  USER_DELETED: "user.deleted",
  USER_RESTORED: "user.restored",
} as const;

export type TUserDomainEventType =
  (typeof UserDomainEventTypes)[keyof typeof UserDomainEventTypes];

export const UserRegisteredEventSchema = z.object({
  eventType: z.literal(UserDomainEventTypes.USER_REGISTERED),
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

/**
 * An existing account attached a seller profile (customer → also seller).
 * auth-service consumes it to add SELLER to the credential's role replica, so
 * the seller app can log in against the same identity.
 */
export const SellerProfileAttachedEventSchema = z.object({
  eventType: z.literal(UserDomainEventTypes.SELLER_PROFILE_ATTACHED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.uuid(),
    email: z.email(),
  }),
});

export type SellerProfileAttachedEvent = z.infer<
  typeof SellerProfileAttachedEventSchema
>;

export const UserDeletedEventSchema = z.object({
  eventType: z.literal(UserDomainEventTypes.USER_DELETED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.uuid(),
    email: z.email(),
    deletedAt: z.iso.datetime(),
    deletedBy: z.enum(["SELF", "ADMIN"]),
  }),
});

export type UserDeletedEvent = z.infer<typeof UserDeletedEventSchema>;

export const UserRestoredEventSchema = z.object({
  eventType: z.literal(UserDomainEventTypes.USER_RESTORED),
  aggregateId: z.uuid(),
  payload: z.object({
    userId: z.uuid(),
    email: z.email(),
  }),
});

export type UserRestoredEvent = z.infer<typeof UserRestoredEventSchema>;

export const UserDomainEventSchema = z.discriminatedUnion("eventType", [
  UserRegisteredEventSchema,
  SellerProfileAttachedEventSchema,
  UserDeletedEventSchema,
  UserRestoredEventSchema,
]);

export type TUserDomainEvent = z.infer<typeof UserDomainEventSchema>;
