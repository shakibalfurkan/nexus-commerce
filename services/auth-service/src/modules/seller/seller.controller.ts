import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { sendSessionResponse } from "../../utils/sendSessionResponse.js";
import { readRequestContext } from "../../utils/requestContext.js";
import { SellerService } from "./seller.service.js";
import type { ISellerRegisterRequestDTO } from "./seller.interface.js";

const registerSeller = catchAsync(async (req: Request, res: Response) => {
  const payload: ISellerRegisterRequestDTO = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    phone: req.body.phone,
    bio: req.body.bio,
  };

  await SellerService.sellerRegisterRequest(payload, readRequestContext(req));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP sent to your email for verification",
    data: null,
  });
});

const verifySellerRegistration = catchAsync(
  async (req: Request, res: Response) => {
    const context = readRequestContext(req);

    const result = await SellerService.verifySellerRegistration(
      { email: req.body.email, otp: req.body.otp },
      context,
      req.requestId,
    );

    sendSessionResponse(res, {
      result,
      clientType: context.clientType,
      statusCode: 201,
      message: "Seller registration successful",
    });
  },
);

const resendSellerOtp = catchAsync(async (req: Request, res: Response) => {
  await SellerService.resendSellerRegistrationOtp(
    req.body.email,
    readRequestContext(req),
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP resent to your email",
    data: null,
  });
});

const loginSellerApp = catchAsync(async (req: Request, res: Response) => {
  const context = readRequestContext(req);

  const result = await SellerService.sellerLogin(
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

export const SellerController = {
  registerSeller,
  verifySellerRegistration,
  resendSellerOtp,
  loginSellerApp,
};
