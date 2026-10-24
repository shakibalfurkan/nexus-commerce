import { BadRequestError } from "@nexus/errors";
import { AuthService } from "../auth/auth.service.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import type {
  IAuthResult,
  ICredentialLoginInput,
  IRequestContext,
} from "../auth/auth.interface.js";
import type {
  ISellerRegisterRequestDTO,
  IVerifyRegistrationDTO,
} from "./seller.interface.js";

/**
 * Seller-app flows. Registration reuses the shared OTP registration core from
 * `modules/auth` (no duplicated OTP logic) and provisions the seller profile in
 * user-service once the OTP is verified.
 */

const SELLER_SURFACE = "seller-web";

function toRegistrationProfile(
  payload: ISellerRegisterRequestDTO,
): Record<string, unknown> {
  return {
    firstName: payload.firstName,
    lastName: payload.lastName,
    ...(payload.phone ? { phone: payload.phone } : {}),
    ...(payload.bio ? { bio: payload.bio } : {}),
  };
}

async function sellerRegisterRequest(
  payload: ISellerRegisterRequestDTO,
  context: IRequestContext,
): Promise<void> {
  await AuthService.assertClientSurface(SELLER_SURFACE, context);

  await AuthService.startRegistration({
    role: UserRoles.SELLER,
    email: payload.email,
    password: payload.password,
    firstName: payload.firstName,
    profile: toRegistrationProfile(payload),
  });
}

async function verifySellerRegistration(
  payload: IVerifyRegistrationDTO,
  context: IRequestContext,
  requestId: string,
): Promise<IAuthResult> {
  await AuthService.assertClientSurface(SELLER_SURFACE, context);

  return AuthService.completeRegistration({
    requestId,
    role: UserRoles.SELLER,
    email: payload.email,
    otp: payload.otp,
  });
}

async function resendSellerRegistrationOtp(
  email: string,
  context: IRequestContext,
): Promise<void> {
  await AuthService.assertClientSurface(SELLER_SURFACE, context);
  await AuthService.resendRegistrationOtp(email, UserRoles.SELLER);
}

/**
 * An account without the SELLER role is rejected with `NO_SELLER_PROFILE`
 * (not a generic 401): the password was already correct, so the dashboard can
 * offer "create your seller profile" instead of "wrong password". That flow is
 * `POST /customers/me/become-seller` in user-service.
 */
async function sellerLogin(
  payload: ICredentialLoginInput,
  context: IRequestContext,
): Promise<IAuthResult> {
  await AuthService.assertClientSurface(SELLER_SURFACE, context);

  const credential = await AuthService.verifyCredentials(
    payload.email,
    payload.password,
  );

  if (!credential.role.includes(UserRoles.SELLER)) {
    throw new BadRequestError(
      "No seller profile exists for this account. Create one to start selling.",
      "NO_SELLER_PROFILE",
    );
  }

  return AuthService.completeLogin(credential, UserRoles.SELLER);
}

export const SellerService = {
  sellerRegisterRequest,
  verifySellerRegistration,
  resendSellerRegistrationOtp,
  sellerLogin,
};
