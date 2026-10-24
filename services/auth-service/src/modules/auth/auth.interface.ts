import type { UserRoles } from "../../generated/prisma/enums.js";

/**
 * Roles an account can self-register into. ADMIN/SUPER_ADMIN are never
 * self-service — they only exist through admin-invite consumption.
 */
export type TRegisterableRole =
  | typeof UserRoles.CUSTOMER
  | typeof UserRoles.SELLER;

/**
 * One per frontend app — the `X-Client-Type` header value. Every register/login
 * route declares the surface it serves so a token minted for one app cannot be
 * produced by another app's endpoint.
 */
export type TClientSurface = "customer-web" | "seller-web" | "admin-web";

export interface IAuthResult {
  id: string;
  email: string;
  role: UserRoles[];
  accessToken?: string;
  refreshToken?: string;
}

export interface ITokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  role: UserRoles[];
}

/** Input shared by every login surface after its own role gate. */
export interface ICredentialLoginInput {
  email: string;
  password: string;
}

export interface IStartRegistrationInput {
  role: TRegisterableRole;
  email: string;
  password: string;
  /** Used for the OTP email greeting and the resend path. */
  firstName: string;
  /**
   * Role-specific fields collected at registration, replayed to user-service
   * once the OTP is verified (no role key — the provisioning endpoint
   * selects the role).
   */
  profile: Record<string, unknown>;
}

/** Cached (Redis) registration payload — password is already hashed. */
export interface ICachedRegistration {
  email: string;
  password: string;
  firstName: string;
  profile: Record<string, unknown>;
}

export interface ICompleteRegistrationInput {
  requestId: string;
  role: TRegisterableRole;
  email: string;
  otp: string;
}

export interface IRequestContext {
  clientType: string | undefined;
  ipAddress: string | undefined;
  userAgent: string | undefined;
}
