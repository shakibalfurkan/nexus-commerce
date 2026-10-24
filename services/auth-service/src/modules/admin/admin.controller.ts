import type { Request, Response } from "express";
import { BadRequestError } from "@nexus/errors";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { sendSessionResponse } from "../../utils/sendSessionResponse.js";
import { readRequestContext } from "../../utils/requestContext.js";
import { AdminService } from "./admin.service.js";
import type { IAdminInviteAcceptDTO } from "./admin.interface.js";

const loginAdmin = catchAsync(async (req: Request, res: Response) => {
  const context = readRequestContext(req);

  const result = await AdminService.adminLogin(
    { email: req.body.email, password: req.body.password },
    context,
  );

  sendSessionResponse(res, {
    result,
    clientType: context.clientType,
    statusCode: 200,
    message: "Login successful",
  });
});

const createInvite = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.createInvite(req.body.email, req.user!.id);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Invite created and emailed to the invitee",
    data: result,
  });
});

const validateInvite = catchAsync(async (req: Request, res: Response) => {
  const token = req.params.token;

  if (typeof token !== "string" || !token) {
    throw new BadRequestError("Invite token is required", "token");
  }

  const result = await AdminService.validateInvite(token);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.valid
      ? "Invite is valid"
      : "Invite is invalid, expired or already used",
    data: result,
  });
});

/**
 * Creates the admin account. No session is issued on purpose: admins must sign
 * in through `POST /admins/login`, which carries the stricter lockout policy.
 */
const acceptInvite = catchAsync(async (req: Request, res: Response) => {
  const token = req.params.token;

  if (typeof token !== "string" || !token) {
    throw new BadRequestError("Invite token is required", "token");
  }

  const payload: IAdminInviteAcceptDTO = {
    password: req.body.password,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phone: req.body.phone,
  };

  const result = await AdminService.acceptInvite(token, payload, req.requestId);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Admin account created. Please sign in.",
    data: result,
  });
});

export const AdminController = {
  loginAdmin,
  createInvite,
  validateInvite,
  acceptInvite,
};
