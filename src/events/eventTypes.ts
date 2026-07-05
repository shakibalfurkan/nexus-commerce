import { z } from "zod";
import { UserRoles } from "../generated/prisma/enums.js";

export const EventNames = {
  USER_CREATED: "user-service.user.created",
  USER_DELETED: "user-service.user.deleted",
  USER_HARD_DELETED: "user-service.user.hard-deleted",
  USER_RESTORED: "user-service.user.restored",
  PROFILE_UPDATED: "user-service.profile.updated",
  ROLE_CHANGED: "user-service.user.role-changed",
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];

export const UserCreatedEventSchema = z.object({
  eventName: z.literal(EventNames.USER_CREATED),
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

/**
 * Emitted when a user is soft-deleted.
 */
export const UserDeletedEventSchema = z.object({
  eventName: z.literal(EventNames.USER_DELETED),
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

/**
 * Emitted when a user is permanently deleted (GDPR erasure).
 */
export const UserHardDeletedEventSchema = z.object({
  eventName: z.literal(EventNames.USER_HARD_DELETED),
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

/**
 * Emitted when a soft-deleted user is restored.
 */
export const UserRestoredEventSchema = z.object({
  eventName: z.literal(EventNames.USER_RESTORED),
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
