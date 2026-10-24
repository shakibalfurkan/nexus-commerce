import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { readRequestContext } from "../../utils/requestContext.js";
import { CustomerProfileService } from "./customer.service.js";
import type {
  BecomeSellerInput,
  ProvisionCustomerProfileInput,
} from "./customer.interface.js";

/** Internal endpoint — authenticated by the HMAC `verifyInternalCall` guard. */
const createCustomerProfile = catchAsync(async (req: Request, res: Response) => {
  const payload: ProvisionCustomerProfileInput = {
    id: req.body.id,
    email: req.body.email,
    firstName: req.body.profile.firstName,
    lastName: req.body.profile.lastName,
    phone: req.body.profile.phone,
    avatar: req.body.profile.avatar,
    dateOfBirth: req.body.profile.dateOfBirth,
  };

  const actorId: string = req.user?.id ?? req.body.id;
  const { ipAddress, userAgent } = readRequestContext(req);

  const result = await CustomerProfileService.createCustomerProfile(
    payload,
    actorId,
    ipAddress,
    userAgent,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Customer profile created successfully",
    data: result,
  });
});

/**
 * Authenticated CUSTOMER attaching a seller profile to their own account.
 * Ownership is enforced by using the token's subject — no id is accepted from
 * the body, so this endpoint cannot be used to modify someone else's account.
 */
const becomeSeller = catchAsync(async (req: Request, res: Response) => {
  const payload: BecomeSellerInput = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phone: req.body.phone,
    bio: req.body.bio,
  };

  const result = await CustomerProfileService.becomeSeller(payload, {
    id: req.user!.id,
    email: req.user!.email,
  });

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Seller profile created. The seller app can sign in shortly.",
    data: result,
  });
});

export const CustomerProfileController = {
  createCustomerProfile,
  becomeSeller,
};
