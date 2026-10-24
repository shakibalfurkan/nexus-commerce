import { UserRoles } from "../../generated/prisma/enums.js";
import * as UserRepository from "../user/user.repository.js";
import { provisionAccount } from "../user/provisionAccount.js";
import type { UserResponseDTO } from "../user/user.dto.js";
import type { ProvisionAdminProfileInput } from "./admin.interface.js";

/**
 * Admin account provisioning — called by auth-service right after an admin
 * invite is consumed. Shares the account sequence with the other roles; only
 * the admin profile write differs.
 */
async function createAdminProfile(
  payload: ProvisionAdminProfileInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserResponseDTO> {
  return provisionAccount({
    id: payload.id,
    email: payload.email,
    role: UserRoles.ADMIN,
    actorId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    ipAddress,
    userAgent,
    createRoleProfile: (tx) =>
      UserRepository.createAdminProfile(
        payload.id,
        payload.firstName,
        payload.lastName,
        tx,
      ),
  });
}

export const AdminProfileService = { createAdminProfile };
