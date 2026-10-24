import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { readRequestContext } from "../../utils/requestContext.js";
import { AdminProfileService } from "./admin.service.js";
import type { ProvisionAdminProfileInput } from "./admin.interface.js";

/** Internal endpoint — authenticated by the HMAC `verifyInternalCall` guard. */
const createAdminProfile = catchAsync(async (req: Request, res: Response) => {
  const payload: ProvisionAdminProfileInput = {
    id: req.body.id,
    email: req.body.email,
    firstName: req.body.profile.firstName,
    lastName: req.body.profile.lastName,
    phone: req.body.profile.phone,
  };

  const actorId: string = req.user?.id ?? req.body.id;
  const { ipAddress, userAgent } = readRequestContext(req);

  const result = await AdminProfileService.createAdminProfile(
    payload,
    actorId,
    ipAddress,
    userAgent,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Admin profile created successfully",
    data: result,
  });
});

export const AdminProfileController = { createAdminProfile };
