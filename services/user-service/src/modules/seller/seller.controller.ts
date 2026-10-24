import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { readRequestContext } from "../../utils/requestContext.js";
import { SellerProfileService } from "./seller.service.js";
import type { ProvisionSellerProfileInput } from "./seller.interface.js";

/** Internal endpoint — authenticated by the HMAC `verifyInternalCall` guard. */
const createSellerProfile = catchAsync(async (req: Request, res: Response) => {
  const payload: ProvisionSellerProfileInput = {
    id: req.body.id,
    email: req.body.email,
    firstName: req.body.profile.firstName,
    lastName: req.body.profile.lastName,
    phone: req.body.profile.phone,
    bio: req.body.profile.bio,
  };

  const actorId: string = req.user?.id ?? req.body.id;
  const { ipAddress, userAgent } = readRequestContext(req);

  const result = await SellerProfileService.createSellerProfile(
    payload,
    actorId,
    ipAddress,
    userAgent,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Seller profile created successfully",
    data: result,
  });
});

export const SellerProfileController = { createSellerProfile };
