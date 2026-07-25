import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { UserService } from "./user.service.js";
import type { CreateUserProfileDTO } from "./user.dto.js";

const createUserProfile = catchAsync(async (req: Request, res: Response) => {
  const payload: CreateUserProfileDTO = {
    id: req.body.id,
    firstName: req.body.profile.firstName,
    lastName: req.body.profile.lastName,
    email: req.body.email,
    role: req.body.role,
    phone: req.body.profile.phone,
    avatar: req.body.profile.avatar,
    dateOfBirth: req.body.profile.dateOfBirth,
    shopData: req.body.profile.shopData,
  };

  const actorId: string = req.user?.id ?? req.body.id;
  const xForwardedFor = req.headers["x-forwarded-for"];
  const ipAddress: string | undefined = Array.isArray(xForwardedFor)
    ? xForwardedFor[0]
    : (xForwardedFor ?? req.socket.remoteAddress ?? undefined);
  const userAgent: string | undefined = req.headers["user-agent"] as
    | string
    | undefined;

  const result = await UserService.createUserProfile(
    payload,
    actorId,
    ipAddress,
    userAgent,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "User profile created successfully",
    data: result,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await UserService.getUserById(id as string);

  if (!result) {
    sendResponse(res, {
      statusCode: 404,
      success: false,
      message: "User not found",
      data: null,
    });
    return;
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User retrieved successfully",
    data: result,
  });
});

const getUserByEmail = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;

  const result = await UserService.getUserByEmail(email as string);

  if (!result) {
    sendResponse(res, {
      statusCode: 404,
      success: false,
      message: "User not found",
      data: null,
    });
    return;
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User retrieved successfully",
    data: result,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const actorId: string = req.user?.id ?? "system";

  await UserService.deleteUser(id as string, actorId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User deleted successfully",
    data: null,
  });
});

const hardDeleteUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const actorId: string = req.user?.id ?? "system";

  await UserService.hardDeleteUser(id as string, actorId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User permanently deleted",
    data: null,
  });
});

const restoreUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const actorId: string = req.user?.id ?? "system";

  const result = await UserService.restoreUser(id as string, actorId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User restored successfully",
    data: result,
  });
});

export const UserController = {
  createUserProfile,
  getUserById,
  getUserByEmail,
  deleteUser,
  hardDeleteUser,
  restoreUser,
};
