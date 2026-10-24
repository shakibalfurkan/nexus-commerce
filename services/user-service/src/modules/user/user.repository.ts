import { randomUUID } from "crypto";

import { prisma } from "../../lib/prisma.js";
import type { PrismaTransaction } from "../../types/database.types.js";
import {
  toUserResponseDTO,
  type CreateUserRecordInput,
  type UserResponseDTO,
} from "./user.dto.js";
import { cacheGet, cacheInvalidate } from "../../cache/cacheManager.js";
import { userProfileKey, userEmailKey, TTL } from "../../cache/cacheKeys.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import type { Prisma } from "../../generated/prisma/client.js";

// ─── Internal Query Helpers ───

const userProfileIncludes = {
  customerProfile: {
    include: {
      shippingAddresses: true,
    },
  },
  sellerProfile: true,
  adminProfile: true,
} as const;

const activeUserFilter = { isDeleted: false };

// ─── Public Repository API ───

export async function createUser(
  data: CreateUserRecordInput,
  tx?: PrismaTransaction,
): Promise<UserResponseDTO> {
  const client = tx ?? prisma;

  const user = await client.user.create({
    data: {
      id: data.id,
      email: data.email,
      role: [data.role],
    },
    include: userProfileIncludes,
  });

  return toUserResponseDTO(user);
}

/** Role attach on an existing account (customer → seller and similar). */
export async function addRole(
  id: string,
  role: UserRoles,
  tx?: PrismaTransaction,
): Promise<void> {
  const client = tx ?? prisma;

  await client.user.update({
    where: { id },
    data: { role: { push: role } },
  });
}

export async function findUserByIdIncludingDeleted(
  id: string,
): Promise<UserResponseDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: userProfileIncludes,
  });
  return user ? toUserResponseDTO(user) : null;
}

export async function findUserById(
  id: string,
): Promise<UserResponseDTO | null> {
  const cacheKey = userProfileKey(id);

  return cacheGet<UserResponseDTO>(
    cacheKey,
    async () => {
      const user = await prisma.user.findUnique({
        where: {
          id,
          ...activeUserFilter,
        },
        include: userProfileIncludes,
      });

      return user ? toUserResponseDTO(user) : null;
    },
    { l2Ttl: TTL.USER_PROFILE },
  );
}

export async function findUserByEmail(
  email: string,
): Promise<UserResponseDTO | null> {
  const cacheKey = userEmailKey(email);

  return cacheGet<UserResponseDTO>(
    cacheKey,
    async () => {
      const user = await prisma.user.findUnique({
        where: {
          email,
          ...activeUserFilter,
        },
        include: userProfileIncludes,
      });

      return user ? toUserResponseDTO(user) : null;
    },
    { l2Ttl: TTL.USER_PROFILE },
  );
}

export async function existsByEmailIncludingDeleted(
  email: string,
): Promise<boolean> {
  const count = await prisma.user.count({
    where: { email },
  });
  return count > 0;
}

export async function softDeleteUser(
  id: string,
  deletedBy: "SELF" | "ADMIN" = "SELF",
  tx?: PrismaTransaction,
): Promise<void> {
  const client = tx ?? prisma;

  await client.user.update({
    where: { id },
    data: {
      isDeleted: true,
      isActive: false,
      deletedAt: new Date(),
      deletedBy,
    },
  });

  await cacheInvalidate(userProfileKey(id));
}

export async function hardDeleteUser(
  id: string,
  tx?: PrismaTransaction,
): Promise<void> {
  const client = tx ?? prisma;
  await client.user.delete({ where: { id } });
}

export async function restoreUser(id: string): Promise<UserResponseDTO> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      isDeleted: false,
      isActive: true,
      deletedAt: null,
      deletedBy: null,
    },
    include: userProfileIncludes,
  });

  await cacheInvalidate(userProfileKey(user.id));

  return toUserResponseDTO(user);
}

/** Drops both cached views of a user after a mutation. */
export async function invalidateUserCache(
  id: string,
  email: string,
): Promise<void> {
  await Promise.all([
    cacheInvalidate(userProfileKey(id)),
    cacheInvalidate(userEmailKey(email)),
  ]);
}

// ─── Role Profile Writes ───

export async function createCustomerProfile(
  userId: string,
  firstName: string,
  lastName: string,
  phone?: string | undefined,
  avatar?: string | undefined,
  dateOfBirth?: string | undefined,
  tx?: PrismaTransaction,
) {
  const client = tx ?? prisma;

  // Schema requires a globally-unique referralCode; none arrives on the wire,
  // so mint one here.
  const referralCode = `${firstName}-${lastName}-${randomUUID().slice(0, 8)}`;

  return client.customerProfile.create({
    data: {
      userId,
      firstName,
      lastName,
      referralCode,
      phone: phone ?? null,
      avatar: avatar ?? null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    },
  });
}

export async function createSellerProfile(
  userId: string,
  firstName: string,
  lastName: string,
  phone?: string | undefined,
  bio?: string | undefined,
  tx?: PrismaTransaction,
) {
  const client = tx ?? prisma;

  return client.sellerProfile.create({
    data: {
      userId,
      firstName,
      lastName,
      phone: phone ?? null,
      bio: bio ?? null,
    },
  });
}

export async function createAdminProfile(
  userId: string,
  firstName: string,
  lastName: string,
  tx?: PrismaTransaction,
) {
  const client = tx ?? prisma;

  return client.adminProfile.create({
    data: {
      userId,
      firstName,
      lastName,
    },
  });
}

// ─── Audit Repository ───

export interface WriteAuditLogInput {
  actorId: string;
  actorEmail: string;
  actorDisplayName: string;
  action: string;
  targetId: string;
  targetType: string;
  oldValues?: Record<string, unknown> | undefined;
  newValues?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * `tx` is optional so callers inside `prisma.$transaction` can keep the audit
 * entry atomic with the write it describes.
 */
export async function writeAuditLog(
  params: WriteAuditLogInput,
  tx?: PrismaTransaction,
): Promise<void> {
  const client = tx ?? prisma;

  await client.auditLog.create({
    data: {
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      actorDisplayName: params.actorDisplayName,
      action: params.action,
      targetId: params.targetId,
      targetType: params.targetType,
      ...(params.oldValues !== undefined
        ? { oldValues: params.oldValues as Prisma.InputJsonValue }
        : {}),
      ...(params.newValues !== undefined
        ? { newValues: params.newValues as Prisma.InputJsonValue }
        : {}),
      ...(params.oldValues && params.newValues
        ? {
            diff: computeDiff(
              params.oldValues,
              params.newValues,
            ) as Prisma.InputJsonValue,
          }
        : {}),
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      ...(params.metadata !== undefined
        ? { metadata: params.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });
}

function computeDiff(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(newValues)) {
    if (key in oldValues && oldValues[key] !== newValues[key]) {
      diff[key] = { from: oldValues[key], to: newValues[key] };
    }
  }

  return diff;
}
