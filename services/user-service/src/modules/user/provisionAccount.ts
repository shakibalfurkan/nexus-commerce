import { ConflictError, InternalServerError } from "@nexus/errors";
import { prisma } from "../../lib/prisma.js";
import { emitDomainEvent } from "@nexus/kafka";
import { UserDomainEventTypes } from "@nexus/event-contracts";
import type { UserRoles } from "../../generated/prisma/enums.js";
import type { PrismaTransaction } from "../../types/database.types.js";
import * as UserRepository from "./user.repository.js";
import type { UserResponseDTO } from "./user.dto.js";

/**
 * Shared account provisioning: user record → role profile → audit log →
 * `user.registered` outbox event, all in ONE transaction.
 *
 * The role-specific part is injected as `createRoleProfile` (a write to the
 * caller's own profile delegate), so the three role modules share the
 * sequencing/audit/event contract without a single `if (role === …)` branch and
 * without triplicating it. Adding the event write inside the same transaction
 * is what makes the outbox guarantee hold (see ADR 0001).
 */
export interface ProvisionAccountInput {
  id: string;
  email: string;
  role: UserRoles;
  actorId: string;
  firstName: string;
  lastName: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  /** Writes the role's profile row using the same transaction client. */
  createRoleProfile: (tx: PrismaTransaction) => Promise<unknown>;
}

export async function provisionAccount(
  input: ProvisionAccountInput,
): Promise<UserResponseDTO> {
  const emailExists = await UserRepository.existsByEmailIncludingDeleted(
    input.email,
  );

  if (emailExists) {
    throw new ConflictError(
      "A user with this email address already exists",
      "email",
    );
  }

  const userId = await prisma.$transaction(async (tx) => {
    await UserRepository.createUser(
      { id: input.id, email: input.email, role: input.role },
      tx,
    );

    await input.createRoleProfile(tx);

    await UserRepository.writeAuditLog(
      {
        actorId: input.actorId,
        actorEmail: "system@nexus.internal",
        actorDisplayName: "user-service",
        action: "USER_CREATED",
        targetId: input.id,
        targetType: "User",
        newValues: {
          email: input.email,
          role: input.role,
          firstName: input.firstName,
          lastName: input.lastName,
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      tx,
    );

    await emitDomainEvent(tx, {
      eventType: UserDomainEventTypes.USER_REGISTERED,
      aggregateId: input.id,
      payload: {
        userId: input.id,
        email: input.email,
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
        createdAt: new Date().toISOString(),
      },
    });

    return input.id;
  });

  // Re-read so the response carries the profile that was just created and the
  // read warms the cache with the complete record.
  const user = await UserRepository.findUserById(userId);

  if (!user) {
    throw new InternalServerError("Account provisioning failed");
  }

  return user;
}
