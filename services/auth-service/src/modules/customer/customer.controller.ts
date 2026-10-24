import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { sendSessionResponse } from "../../utils/sendSessionResponse.js";
import { readRequestContext } from "../../utils/requestContext.js";
import { CustomerService } from "./customer.service.js";
import type { ICustomerRegisterRequestDTO } from "./customer.interface.js";

const registerCustomer = catchAsync(async (req: Request, res: Response) => {
  const payload: ICustomerRegisterRequestDTO = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    acceptTerms: req.body.acceptTerms,
    marketingOptIn: req.body.marketingOptIn,
  };

  await CustomerService.customerRegisterRequest(
    payload,
    readRequestContext(req),
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP sent to your email for verification",
    data: null,
  });
});

const verifyCustomerRegistration = catchAsync(
  async (req: Request, res: Response) => {
    const context = readRequestContext(req);

    const result = await CustomerService.verifyCustomerRegistration(
      { email: req.body.email, otp: req.body.otp },
      context,
      req.requestId,
    );

    sendSessionResponse(res, {
      result,
      clientType: context.clientType,
      statusCode: 201,
      message: "Registration successful",
    });
  },
);

const resendCustomerOtp = catchAsync(async (req: Request, res: Response) => {
  await CustomerService.resendCustomerRegistrationOtp(
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

const loginCustomerApp = catchAsync(async (req: Request, res: Response) => {
  const context = readRequestContext(req);

  const result = await CustomerService.customerLogin(
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

export const CustomerController = {
  registerCustomer,
  verifyCustomerRegistration,
  resendCustomerOtp,
  loginCustomerApp,
};
