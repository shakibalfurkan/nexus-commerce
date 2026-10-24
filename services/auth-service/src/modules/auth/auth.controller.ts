import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { clearCookie, setCookie } from "../../utils/cookieHandler.js";
import { AuthService } from "./auth.service.js";
import { readRequestContext } from "../../utils/requestContext.js";

/**
 * Session-level auth routes — surface-agnostic by design (a refresh token
 * carries its own active role, so no role gate applies here).
 */

const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  const { clientType } = readRequestContext(req);

  const result = await AuthService.refreshToken(token);
  const tokensInBody = clientType === "customer-web";

  if (!tokensInBody) {
    setCookie(res, "accessToken", result.accessToken, ACCESS_TOKEN_MAX_AGE_MS);
    setCookie(
      res,
      "refreshToken",
      result.refreshToken,
      REFRESH_TOKEN_MAX_AGE_MS,
    );
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Token refreshed successfully",
    data: {
      role: result.role,
      ...(tokensInBody && {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }),
    },
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;

  await AuthService.logout(token);

  clearCookie(res, "accessToken");
  clearCookie(res, "refreshToken");

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logged out successfully",
    data: null,
  });
});

const requestPasswordReset = catchAsync(async (req: Request, res: Response) => {
  const { clientType } = readRequestContext(req);

  await AuthService.requestPasswordReset(req.body.email, clientType);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      "If an account with that email exists, a password reset link has been sent.",
    data: null,
  });
});

const verifyPasswordReset = catchAsync(async (req: Request, res: Response) => {
  await AuthService.verifyPasswordReset({
    resetToken: req.body.resetToken,
    newPassword: req.body.newPassword,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password has been reset successfully.",
    data: null,
  });
});

const requestAccountRestore = catchAsync(async (req: Request, res: Response) => {
  await AuthService.requestAccountRestore(req.body.email);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "If an account with that email exists, a restore OTP has been sent.",
    data: null,
  });
});

const verifyAccountRestore = catchAsync(async (req: Request, res: Response) => {
  await AuthService.verifyAccountRestore(req.body.email, req.body.otp);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Account restored successfully.",
    data: null,
  });
});

export const AuthController = {
  requestAccountRestore,
  verifyAccountRestore,
  refreshToken,
  logout,
  requestPasswordReset,
  verifyPasswordReset,
};
