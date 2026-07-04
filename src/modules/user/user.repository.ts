// ─── Staff-Level Repository Layer ───
// The ONLY layer that touches Prisma. Service layer is completely unaware of
// the ORM. This abstraction allows swapping Prisma for Drizzle, TypeORM, or
// raw SQL without changing a single line of business logic.
//
// Key patterns:
// 1. Every public method is async and returns typed DTOs or null
// 2. Write operations use Prisma transactions for atomicity
// 3. Soft-deleted records are excluded from all queries
// 4. Cache-aside hooks are prepared for Sprint 3 integration

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

// ─── Internal Query Helpers ───

const userProfileIncludes = {
  customerProfile: {
    include: {
      shippingAddresses: true,
    },
  },
  sellerProfile: {
    include: {
      shopAddress: true,
    },
  },
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
