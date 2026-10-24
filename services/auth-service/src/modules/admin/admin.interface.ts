/**
 * Admin surface.
 *
 * Admin accounts can never self-register: the only creation path is consuming a
 * single-use invite. Invite *creation* is a SUPER_ADMIN-guarded action inside
 * this module — a dedicated `superAdmin/` module for one route would be
 * indirection without a consumer.
 */

export interface IAdminInviteAcceptDTO {
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | undefined;
}

export interface ICreatedAdminInvite {
  id: string;
  email: string;
  expiresAt: string;
}

export type TInviteValidationStatus =
  | "PENDING"
  | "EXPIRED"
  | "CONSUMED"
  | "INVALID";

export interface IInviteValidationResult {
  valid: boolean;
  status: TInviteValidationStatus;
  email?: string;
  expiresAt?: string;
}
