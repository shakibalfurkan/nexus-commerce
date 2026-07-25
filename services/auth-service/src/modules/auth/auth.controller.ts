import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import { AuthService } from "./auth.service.js";
import sendResponse from "../../utils/sendResponse.js";
import { setCookie, clearCookie } from "../../utils/cookieHandler.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import type { IAuthResult, IRegisterRequestDTO } from "./auth.interface.js";

const registerRequest = catchAsync(async (req: Request, res: Response) => {
  const payload: IRegisterRequestDTO = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    role: req.body.role,
    password: req.body.password,
  };

  const clientType = req.headers["x-client-type"] as string | undefined;
  const xForwardedFor = req.headers["x-forwarded-for"];
  const ipAddress: string | undefined = Array.isArray(xForwardedFor)
    ? xForwardedFor[0]
    : (xForwardedFor ?? req.socket.remoteAddress ?? undefined);
  const userAgent: string | undefined = req.headers["user-agent"] as
    | string
    | undefined;

  const result = await AuthService.registerRequest(
    payload,
    clientType,
    ipAddress,
    userAgent,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP sent to your email",
    data: result,
  });
});

const verifyRegistration = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const requestId = req.requestId;
  const clientType = req.headers["x-client-type"] as string | undefined;

  const { accessToken, refreshToken, ...credentialData } =
    await AuthService.verifyRegistration(requestId!, {
      email,
      otp,
      ...(clientType ? { clientType } : {}),
    });

  const isCustomer = clientType === "customer-web";

  if (!isCustomer) {
    setCookie(res, "accessToken", accessToken!, 60 * 60 * 1000);
    setCookie(res, "refreshToken", refreshToken!, 7 * 24 * 60 * 60 * 1000);
  }

  const credentials: IAuthResult = {
    ...credentialData,
    ...(accessToken && isCustomer && { accessToken }),
    ...(refreshToken && isCustomer && { refreshToken }),
  };

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Registration successful",
    data: credentials,
  });
});

const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await AuthService.resendOtp(email);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP resent to your email",
    data: result,
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const clientType = req.headers["x-client-type"] as string | undefined;
  const xForwardedFor = req.headers["x-forwarded-for"];
  const ipAddress: string | undefined = Array.isArray(xForwardedFor)
    ? xForwardedFor[0]
    : (xForwardedFor ?? req.socket.remoteAddress ?? undefined);
  const userAgent: string | undefined = req.headers["user-agent"] as
    | string
    | undefined;

  const { accessToken, refreshToken, ...credentialData } =
    await AuthService.login({
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      clientType,
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    });

  const isCustomer = clientType === "customer-web";

  if (!isCustomer) {
    setCookie(res, "accessToken", accessToken!, 60 * 60 * 1000);
    setCookie(res, "refreshToken", refreshToken!, 7 * 24 * 60 * 60 * 1000);
  }

  const credentials: IAuthResult = {
    ...credentialData,
    ...(accessToken && isCustomer && { accessToken }),
    ...(refreshToken && isCustomer && { refreshToken }),
  };

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Login successful",
    data: credentials,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;

  const clientType = req.headers["x-client-type"] as string | undefined;

  const result = await AuthService.refreshToken(token);

  const isCustomer = clientType === "customer-web";

  if (!isCustomer) {
    setCookie(res, "accessToken", result.accessToken!, 60 * 60 * 1000);
    setCookie(
      res,
      "refreshToken",
      result.refreshToken!,
      7 * 24 * 60 * 60 * 1000,
    );
  }

  const responseData = {
    ...(result.accessToken &&
      isCustomer && { accessToken: result.accessToken }),
    ...(result.refreshToken &&
      isCustomer && { refreshToken: result.refreshToken }),
  };

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Token refreshed successfully",
    data: responseData,
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
  const { email } = req.body;
  const clientType = req.headers["x-client-type"] as string;

  await AuthService.requestPasswordReset(email, clientType);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      "If an account with that email exists, a password reset link has been sent.",
    data: null,
  });
});

const verifyPasswordReset = catchAsync(async (req: Request, res: Response) => {
  const { resetToken, newPassword } = req.body;
  await AuthService.verifyPasswordReset({ resetToken, newPassword });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password has been reset successfully.",
    data: null,
  });
});

// ═══════════════════════════════════════════════════════════════════
// PROVISIONING (Task 2)
// ═══════════════════════════════════════════════════════════════════

const provisionSeller = catchAsync(async (req: Request, res: Response) => {
  const credentialId = req.user!.id;
  await AuthService.provisionSeller(credentialId);

  sendResponse(res, {
    statusCode: 202,
    success: true,
    message: "Request received, your seller account will be ready shortly",
    data: null,
  });
});

const provisionCustomer = catchAsync(async (req: Request, res: Response) => {
  const credentialId = req.user!.id;
  await AuthService.provisionCustomer(credentialId);

  sendResponse(res, {
    statusCode: 202,
    success: true,
    message: "Request received, your customer account will be ready shortly",
    data: null,
  });
});

export const AuthController = {
  registerRequest,
  verifyRegistration,
  resendOtp,
  login,
  refreshToken,
  logout,
  requestPasswordReset,
  verifyPasswordReset,
  provisionSeller,
  provisionCustomer,
};
