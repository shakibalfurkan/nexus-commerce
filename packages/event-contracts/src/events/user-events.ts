import { z } from "zod";
import { EventMetadataSchema, type EventMetadata } from "../envelope.js";

/**
 * user-service produced domain events.
 *
 * Only `user.registered` has a real producer (user.service.createUserProfile).
 * The other constants + schemas were historically defined but NEVER emitted
 * (deleteUser/hardDeleteUser/restoreUser write only audit logs; the user.*
 * update/lock events + order.placed/payment.succeeded have no producer or
 * consumer). Per the consolidation decision, dead schemas are dropped — this
 * file contains ONLY the event actually produced today.
 */

export const UserDomainEventTypes = {
  USER_REGISTERED: "user.registered",
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
  metadata: EventMetadataSchema,
});

export type UserRegisteredEvent = z.infer<typeof UserRegisteredEventSchema>;

export const UserDomainEventSchema = z.discriminatedUnion("eventType", [
  UserRegisteredEventSchema,
]);

export type TUserDomainEvent = z.infer<typeof UserDomainEventSchema>;

export type { EventMetadata };
