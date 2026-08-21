import { z } from "zod";


/**
 * user-service produced domain events.
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
});

export type UserRegisteredEvent = z.infer<typeof UserRegisteredEventSchema>;

export const UserDomainEventSchema = z.discriminatedUnion("eventType", [
  UserRegisteredEventSchema,
]);

export type TUserDomainEvent = z.infer<typeof UserDomainEventSchema>;

