// ─── Staff-Level Service Layer ───
// Pure domain logic. Zero Prisma imports. Zero database awareness.
// Orchestrates repository calls, enforces business rules, and handles
// cryptographic PII protection.
//
// Key patterns:
// 1. Every method is a self-contained business transaction
// 2. Repository methods are composed atomically via Prisma transactions
// 3. Business rules are enforced BEFORE data access (fail-fast)
// 4. Audit logging is a cross-cutting concern applied at the service level
// 5. PII encryption is automatically applied on user creation
// 6. Cryptographic shredding precedes hard deletion (GDPR Right to Erasure)

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
  // ─── Business Rule 1: Email uniqueness ───
  const emailExists = await UserRepository.existsByEmailIncludingDeleted(
    payload.email,
  );
  if (emailExists) {
    throw new ConflictError(
      "A user with this email address already exists",
      "email",
    );
  }

  // ─── Business Rule 2: Seller data validation ───
  if (payload.role === UserRoles.SELLER && !payload.shopData) {
    throw new BadRequestError(
      "Shop data is required for seller registration",
      "shopData",
    );
  }

  // ─── Atomic Transaction: User + Profile + Encryption + Audit ───
  const result = await prisma.$transaction(async (tx) => {
    // Step 1: Initialize PII encryption (creates encryption key + encrypts email)
    const { encryptedEmail, emailBlindIndex } = await initializeUserEncryption(
      payload.id,
      payload.email,
      tx,
    );

    // Step 2: Create the user record (with encrypted email and blind index)
    const user = await UserRepository.createUserWithEncryption(
      {
        ...payload,
        encryptedEmail,
        emailBlindIndex,
      },
      tx,
    );

    // Step 3: Create the role-specific profile
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

    // Step 4: Write audit log (within the same transaction)
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

    return user;
  });

  return result;
}
