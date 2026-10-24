import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "@nexus/errors";
import { prisma } from "../../lib/prisma.js";
import { emitDomainEvent } from "@nexus/kafka";
import { UserDomainEventTypes } from "@nexus/event-contracts";
import { UserRoles } from "../../generated/prisma/enums.js";
import * as UserRepository from "../user/user.repository.js";
import { provisionAccount } from "../user/provisionAccount.js";
import type { UserResponseDTO } from "../user/user.dto.js";
import type {
  BecomeSellerInput,
  ProvisionCustomerProfileInput,
} from "./customer.interface.js";

/**
 * Customer module service — two features, both owned here because the route
 * (`/customers/...`) decides the role:
 *
 *  - `createCustomerProfile` — internal, provisioning a brand-new customer
 *    (auth-service, after the registration OTP is verified);
 *  - `becomeSeller` — an authenticated CUSTOMER attaching a seller profile to
 *    their EXISTING account (no new user record), which is what makes the
 *    dual-role model work. Same checks in the same order, same single
 *    transaction (seller profile → SELLER role → audit → outbox event), same
 *    cache invalidation as before the feature was co-located here.
 *
 * Shares the account sequence (user row → profile → audit → event) with the
 * other roles via `provisionAccount`, so only the profile write is
 * customer-specific.
 */
async function createCustomerProfile(
  payload: ProvisionCustomerProfileInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserResponseDTO> {
  return provisionAccount({
    id: payload.id,
    email: payload.email,
    role: UserRoles.CUSTOMER,
    actorId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    ipAddress,
    userAgent,
    createRoleProfile: (tx) =>
      UserRepository.createCustomerProfile(
        payload.id,
        payload.firstName,
        payload.lastName,
        payload.phone,
        payload.avatar,
        payload.dateOfBirth,
        tx,
      ),
  });
}

const ADMIN_ROLES: readonly UserRoles[] = [
  UserRoles.ADMIN,
  UserRoles.SUPER_ADMIN,
];

function isAdminRole(role: UserRoles): boolean {
  return ADMIN_ROLES.includes(role);
}

async function becomeSeller(
  payload: BecomeSellerInput,
  actor: { id: string; email: string },
): Promise<UserResponseDTO> {
  const user = await UserRepository.findUserById(actor.id);

  if (!user) {
    throw new NotFoundError("User not found", "id");
  }

  // Hard rule: admin identities never hold customer/seller roles.
  if (user.role.some(isAdminRole)) {
    throw new ForbiddenError(
      "Admin identities cannot gain customer or seller roles",
    );
  }

  if (user.role.includes(UserRoles.SELLER)) {
    throw new ConflictError(
      "A seller profile already exists on this account",
      "sellerProfile",
    );
  }

  await prisma.$transaction(async (tx) => {
    await UserRepository.createSellerProfile(
      actor.id,
      payload.firstName,
      payload.lastName,
      payload.phone,
      payload.bio,
      tx,
    );

    await UserRepository.addRole(actor.id, UserRoles.SELLER, tx);

    await UserRepository.writeAuditLog(
      {
        actorId: actor.id,
        actorEmail: actor.email,
        actorDisplayName: `${payload.firstName} ${payload.lastName}`,
        action: "SELLER_PROFILE_ATTACHED",
        targetId: actor.id,
        targetType: "User",
        oldValues: { role: user.role },
        newValues: { role: [...user.role, UserRoles.SELLER] },
      },
      tx,
    );

    // auth-service consumes this to add SELLER to the credential's role
    // replica — user-service never writes another service's data.
    await emitDomainEvent(tx, {
      eventType: UserDomainEventTypes.SELLER_PROFILE_ATTACHED,
      aggregateId: actor.id,
      payload: { userId: actor.id, email: actor.email },
    });
  });

  await UserRepository.invalidateUserCache(actor.id, actor.email);

  const updated = await UserRepository.findUserById(actor.id);

  if (!updated) {
    throw new InternalServerError("Seller profile attachment failed");
  }

  return updated;
}

export const CustomerProfileService = {
  createCustomerProfile,
  becomeSeller,
};
