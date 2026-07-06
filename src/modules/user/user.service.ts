import { prisma } from "../../lib/prisma.js";
import { BadRequestError, ConflictError } from "../../errors/AppError.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import type { CreateUserProfileDTO, UserResponseDTO } from "./user.dto.js";
import * as UserRepository from "./user.repository.js";
import {
  initializeUserEncryption,
  destroyUserEncryptionKey,
  hasActiveEncryptionKey,
} from "../../crypto/keyManager.js";
import { emitDomainEvent } from "../../events/outboxWriter.js";
import { DomainEventTypes } from "../../events/eventTypes.js";

// ─── Domain Constants ───

const ADMIN_ROLES: readonly UserRoles[] = [
  UserRoles.ADMIN,
  UserRoles.SUPER_ADMIN,
] as const;

// ─── Public Service API ───

export async function createUserProfile(
  payload: CreateUserProfileDTO,
  actorId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserResponseDTO> {
  const emailExists = await UserRepository.existsByEmailIncludingDeleted(
    payload.email,
  );
  if (emailExists) {
    throw new ConflictError(
      "A user with this email address already exists",
      "email",
    );
  }

  if (payload.role === UserRoles.SELLER && !payload.shopData) {
    throw new BadRequestError(
      "Shop data is required for seller registration",
      "shopData",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const { encryptedEmail, emailBlindIndex } = await initializeUserEncryption(
      payload.id,
      payload.email,
      tx,
    );

    const user = await UserRepository.createUserWithEncryption(
      {
        ...payload,
        encryptedEmail,
        emailBlindIndex,
      },
      tx,
    );

    if (payload.role === UserRoles.CUSTOMER) {
      await UserRepository.createCustomerProfile(
        payload.id,
        payload.firstName,
        payload.lastName,
        payload.phone,
        payload.avatar,
        payload.dateOfBirth,
        tx,
      );
    } else if (payload.role === UserRoles.SELLER) {
      await UserRepository.createSellerProfile(
        payload.id,
        payload.firstName,
        payload.lastName,
        payload.shopData!,
        tx,
      );
    } else if (ADMIN_ROLES.includes(payload.role)) {
      await UserRepository.createAdminProfile(
        payload.id,
        payload.firstName,
        payload.lastName,
        tx,
      );
    }

    await UserRepository.writeAuditLog({
      actorId,
      action: "USER_CREATED",
      targetId: payload.id,
      targetType: "User",
      newValues: {
        email: payload.email,
        role: payload.role,
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
      ipAddress,
      userAgent,
    });

    await emitDomainEvent(tx, {
      eventName: DomainEventTypes.USER_REGISTERED,
      aggregateId: user.id,
      payload: {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.profile?.firstName ?? "",
        lastName: user.profile?.lastName ?? "",
        createdAt: user.createdAt,
      },
      metadata: {
        emittedAt: new Date().toISOString(),
        source: "user-service",
        version: 1,
      },
    });

    return user;
  });

  return result;
}

export async function getUserById(id: string): Promise<UserResponseDTO | null> {
  return UserRepository.findUserById(id);
}

export async function getUserByEmail(
  email: string,
): Promise<UserResponseDTO | null> {
  const user = await UserRepository.findUserByEmailBlindIndex(email);

  if (!user) {
    return null;
  }

  return user;
}

export async function deleteUser(id: string, actorId: string): Promise<void> {
  const user = await UserRepository.findUserById(id);
  if (!user) {
    throw new BadRequestError("User not found", "id");
  }

  await prisma.$transaction(async (tx) => {
    await UserRepository.softDeleteUser(id);

    await UserRepository.writeAuditLog({
      actorId,
      action: "USER_DELETED",
      targetId: id,
      targetType: "User",
      oldValues: { email: user.email, role: user.role },
      ipAddress: undefined,
      userAgent: undefined,
    });
  });
}

export async function hardDeleteUser(
  id: string,
  actorId: string,
): Promise<void> {
  const user = await UserRepository.findUserById(id);
  if (!user) {
    throw new BadRequestError("User not found", "id");
  }

  await prisma.$transaction(async (tx) => {
    const hasKey = await hasActiveEncryptionKey(id);
    if (hasKey) {
      await destroyUserEncryptionKey(id, tx);
    }

    await UserRepository.hardDeleteUser(id, tx);

    await UserRepository.writeAuditLog({
      actorId,
      action: "USER_HARD_DELETED",
      targetId: id,
      targetType: "User",
      oldValues: { email: user.email, role: user.role },
      ipAddress: undefined,
      userAgent: undefined,
    });
  });
}

export async function restoreUser(
  id: string,
  actorId: string,
): Promise<UserResponseDTO> {
  const user = await UserRepository.restoreUser(id);

  await UserRepository.writeAuditLog({
    actorId,
    action: "USER_RESTORED",
    targetId: id,
    targetType: "User",
    newValues: { email: user.email, role: user.role },
    ipAddress: undefined,
    userAgent: undefined,
  });

  return user;
}

export const UserService = {
  createUserProfile,
  getUserById,
  getUserByEmail,
  deleteUser,
  hardDeleteUser,
  restoreUser,
};
