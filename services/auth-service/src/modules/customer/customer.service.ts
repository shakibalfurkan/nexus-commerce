import { BadRequestError } from "@nexus/errors";
import { AuthService } from "../auth/auth.service.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import type {
  IAuthResult,
  ICredentialLoginInput,
  IRequestContext,
} from "../auth/auth.interface.js";
import type {
  ICustomerRegisterRequestDTO,
  IVerifyRegistrationDTO,
} from "./customer.interface.js";

/**
 * Customer-app flows. Registration keeps the existing CustomerRegisterRequest
 * shape (name, password confirmation, terms, marketing opt-in) and the existing
 * `auth:reg:CUSTOMER:<email>` cache convention; the OTP mechanics come from the
 * shared auth module.
 *
 * Every entry point takes the request context so the customer surface guard
 * runs exactly once, in one place, per request.
 */

const CUSTOMER_SURFACE = "customer-web";

function toRegistrationProfile(
  payload: ICustomerRegisterRequestDTO,
): Record<string, unknown> {
  return {
    firstName: payload.firstName,
    lastName: payload.lastName,
  };
}

async function customerRegisterRequest(
  payload: ICustomerRegisterRequestDTO,
  context: IRequestContext,
): Promise<void> {
  await AuthService.assertClientSurface(CUSTOMER_SURFACE, context);

  await AuthService.startRegistration({
    role: UserRoles.CUSTOMER,
    email: payload.email,
    password: payload.password,
    firstName: payload.firstName,
    profile: toRegistrationProfile(payload),
  });
}

async function verifyCustomerRegistration(
  payload: IVerifyRegistrationDTO,
  context: IRequestContext,
  requestId: string,
): Promise<IAuthResult> {
  await AuthService.assertClientSurface(CUSTOMER_SURFACE, context);

  return AuthService.completeRegistration({
    requestId,
    role: UserRoles.CUSTOMER,
    email: payload.email,
    otp: payload.otp,
  });
}

async function resendCustomerRegistrationOtp(
  email: string,
  context: IRequestContext,
): Promise<void> {
  await AuthService.assertClientSurface(CUSTOMER_SURFACE, context);
  await AuthService.resendRegistrationOtp(email, UserRoles.CUSTOMER);
}

/**
 * Dual-role safe: the password is verified once against the shared identity,
 * then this surface only checks that a customer profile exists. A missing one
 * is a distinguishable error (not a 401) so the storefront can offer to create
 * a profile instead of showing "wrong password".
 */
async function customerLogin(
  payload: ICredentialLoginInput,
  context: IRequestContext,
): Promise<IAuthResult> {
  await AuthService.assertClientSurface(CUSTOMER_SURFACE, context);

  const credential = await AuthService.verifyCredentials(
    payload.email,
    payload.password,
  );

  if (!credential.role.includes(UserRoles.CUSTOMER)) {
    throw new BadRequestError(
      "No customer profile exists for this account. Please create one to continue.",
      "NO_CUSTOMER_PROFILE",
    );
  }

  return AuthService.completeLogin(credential, UserRoles.CUSTOMER);
}

export const CustomerService = {
  customerRegisterRequest,
  verifyCustomerRegistration,
  resendCustomerRegistrationOtp,
  customerLogin,
};
