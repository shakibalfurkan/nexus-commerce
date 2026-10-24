import { prisma } from "../../lib/prisma.js";
import { BadRequestError } from "@nexus/errors";
import { emitDomainEvent } from "@nexus/kafka";
import { UserDomainEventTypes } from "@nexus/event-contracts";
import type { UserResponseDTO } from "./user.dto.js";
import * as UserRepository from "./user.repository.js";

/**
 * User record operations (read / soft delete / hard delete / restore).
 * Account *creation* lives with the role modules that own the profile shape —
 * see `modules/{customer,seller,admin}` and the shared `provisionAccount`.
 */

async function getUserById(id: string): Promise<UserResponseDTO | null> {
  return UserRepository.findUserById(id);
}

async function getUserByEmail(
  email: string,
): Promise<UserResponseDTO | null> {
  return UserRepository.findUserByEmail(email);
}

async function deleteUser(id: string, actorId: string): Promise<void> {
  const user = await UserRepository.findUserById(id);
  if (!user) {
    throw new BadRequestError("User not found", "id");
  }

  const deletedBy = actorId === id ? "SELF" : "ADMIN";
  const deletedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await UserRepository.softDeleteUser(id, deletedBy, tx);

    await UserRepository.writeAuditLog(
      {
        actorId,
        actorEmail: "system@nexus.internal",
        actorDisplayName: "user-service",
        action: "USER_DELETED",
        targetId: id,
        targetType: "User",
        oldValues: { email: user.email, role: user.role },
      },
      tx,
    );

    await emitDomainEvent(tx, {
      eventType: UserDomainEventTypes.USER_DELETED,
      aggregateId: id,
      payload: {
        userId: id,
        email: user.email,
        deletedAt: deletedAt.toISOString(),
        deletedBy,
      },
    });
  });
}

async function hardDeleteUser(
  id: string,
  actorId: string,
): Promise<void> {
  const user = await UserRepository.findUserById(id);
  if (!user) {
    throw new BadRequestError("User not found", "id");
  }

  await prisma.$transaction(async (tx) => {
    await UserRepository.hardDeleteUser(id, tx);

    await UserRepository.writeAuditLog(
      {
        actorId,
        actorEmail: "system@nexus.internal",
        actorDisplayName: "user-service",
        action: "USER_HARD_DELETED",
        targetId: id,
        targetType: "User",
        oldValues: { email: user.email, role: user.role },
      },
      tx,
    );
  });
}

const OWNER_RESTORE_DAYS = 30;
const ADMIN_RESTORE_DAYS = 60;

async function restoreUser(
  id: string,
  actorId: string,
): Promise<UserResponseDTO> {
  const raw = await prisma.user.findUnique({ where: { id } });
  if (!raw) {
    throw new BadRequestError("User not found", "id");
  }
  if (!raw.deletedAt) {
    throw new BadRequestError("Account is not restorable", "id");
  }

  const graceDays =
    raw.deletedBy === "ADMIN" ? ADMIN_RESTORE_DAYS : OWNER_RESTORE_DAYS;
  const deadline = new Date(
    raw.deletedAt.getTime() + graceDays * 24 * 60 * 60 * 1000,
  );
  if (new Date() > deadline) {
    throw new BadRequestError("Restore window expired", "id");
  }

  const user = await UserRepository.restoreUser(id);

  await UserRepository.writeAuditLog({
    actorId,
    actorEmail: "system@nexus.internal",
    actorDisplayName: "user-service",
    action: "USER_RESTORED",
    targetId: id,
    targetType: "User",
    newValues: { email: user.email, role: user.role },
  });

  await prisma.$transaction(async (tx) => {
    await emitDomainEvent(tx, {
      eventType: UserDomainEventTypes.USER_RESTORED,
      aggregateId: id,
      payload: { userId: id, email: user.email },
    });
  });

  return user;
}

export const UserService = {
  getUserById,
  getUserByEmail,
  deleteUser,
  hardDeleteUser,
  restoreUser,
};
