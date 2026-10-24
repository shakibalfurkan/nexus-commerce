import { UserRoles } from "../../generated/prisma/enums.js";
import * as UserRepository from "../user/user.repository.js";
import { provisionAccount } from "../user/provisionAccount.js";
import type { UserResponseDTO } from "../user/user.dto.js";
import type { ProvisionSellerProfileInput } from "./seller.interface.js";

/**
 * Seller-profile provisioning — called by auth-service after the registration
 * OTP is verified. Shares the account sequence (user row → profile → audit →
 * event) with the other roles, so only the profile write is seller-specific.
 *
 * The dual-role attach (customer → also seller, `POST /customers/me/become-seller`)
 * lives in the customer module: the authenticated customer route owns that
 * feature end-to-end.
 */
async function createSellerProfile(
  payload: ProvisionSellerProfileInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserResponseDTO> {
  return provisionAccount({
    id: payload.id,
    email: payload.email,
    role: UserRoles.SELLER,
    actorId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    ipAddress,
    userAgent,
    createRoleProfile: (tx) =>
      UserRepository.createSellerProfile(
        payload.id,
        payload.firstName,
        payload.lastName,
        payload.phone,
        payload.bio,
        tx,
      ),
  });
}

export const SellerProfileService = { createSellerProfile };
