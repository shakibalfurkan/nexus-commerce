import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { UserService } from "./user.service.js";

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

const getUserMe = catchAsync(async (req: Request, res: Response) => {
  const id = req.user!.id;
  const result = await UserService.getUserById(id);
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

const deleteMe = catchAsync(async (req: Request, res: Response) => {
  const id = req.user!.id;
  await UserService.deleteUser(id, id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User deleted successfully",
    data: null,
  });
});

export const UserController = {
  getUserById,
  getUserByEmail,
  deleteUser,
  hardDeleteUser,
  restoreUser,
  getUserMe,
  deleteMe,
};
