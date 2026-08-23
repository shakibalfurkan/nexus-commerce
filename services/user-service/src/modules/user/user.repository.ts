import { randomUUID } from "crypto";

import { prisma } from "../../lib/prisma.js";
import type {
  PrismaTransaction,
  CursorPaginationResult,
} from "../../types/database.types.js";
import {
  toUserResponseDTO,
  type UserResponseDTO,
  type CreateUserProfileDTO,
} from "./user.dto.js";
import { cacheGet, cacheInvalidate } from "../../cache/cacheManager.js";
import { userProfileKey, userEmailKey, TTL } from "../../cache/cacheKeys.js";
import {
  decodeCursor,
  buildCursorWhere,
  paginateResult,
} from "../../pagination/cursorPagination.js";
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
  data: CreateUserProfileDTO,
  tx?: PrismaTransaction,
): Promise<UserResponseDTO> {
  const client = tx ?? prisma;

  const user = await client.user.create({
    data: {
      id: data.id,
      email: data.email,
      role: data.role,
    },
    include: userProfileIncludes,
  });

  return toUserResponseDTO(user);
}

export async function createUserWithEncryption(
  data: CreateUserProfileDTO & {
    encryptedEmail: string;
    emailBlindIndex: string;
  },
  tx?: PrismaTransaction,
): Promise<UserResponseDTO> {
  const client = tx ?? prisma;

  const user = await client.user.create({
    data: {
      id: data.id,
      email: data.email,
      encryptedEmail: data.encryptedEmail,
      emailBlindIndex: data.emailBlindIndex,
      role: data.role,
    },
    include: userProfileIncludes,
  });

  return toUserResponseDTO(user);
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

export async function existsById(id: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: {
      id,
      ...activeUserFilter,
    },
  });
  return count > 0;
}

export async function softDeleteUser(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: {
      isDeleted: true,
      isActive: false,
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
    },
    include: userProfileIncludes,
  });

  await cacheInvalidate(userProfileKey(user.id));

  return toUserResponseDTO(user);
}

export async function createCustomerProfile(
  userId: string,
  firstName: string,
  lastName: string,
  phone?: string,
  avatar?: string,
  dateOfBirth?: string,
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
  shopData: NonNullable<CreateUserProfileDTO["shopData"]>,
  tx?: PrismaTransaction,
) {
  const client = tx ?? prisma;

  return client.sellerProfile.create({
    data: {
      userId,
      firstName,
      lastName,
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

// ─── Cursor-Based Pagination ───

export interface ListUsersFilters {
  role?: UserRoles;
  isActive?: boolean;
  search?: string;
}

export async function listUsers(
  cursor: string | undefined,
  limit: number,
  filters: ListUsersFilters = {},
): Promise<CursorPaginationResult<UserResponseDTO>> {
  const take = limit + 1;

  const where: Record<string, unknown> = {
    ...activeUserFilter,
  };

  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.search) {
    where.email = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  let cursorWhere: Record<string, unknown> = {};
  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    cursorWhere = buildCursorWhere(decodedCursor, where);
  } else {
    cursorWhere = where;
  }

  const users = await prisma.user.findMany({
    where: cursorWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
    include: userProfileIncludes,
  });

  const paginated = paginateResult(users, limit);
  return {
    data: paginated.data.map(toUserResponseDTO),
    nextCursor: paginated.nextCursor,
    hasMore: paginated.hasMore,
  };
}

// ─── Audit Repository ───
export async function writeAuditLog(params: {
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
}): Promise<void> {
  await prisma.auditLog.create({
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
