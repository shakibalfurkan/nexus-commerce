import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import type { ICustomerRegisterRequestDTO } from "./customer.interface.js";
import sendResponse from "../../utils/sendResponse.js";
import { CustomerService } from "./customer.service.js";

const CustomerRegisterRequest = catchAsync(
  async (req: Request, res: Response) => {
    const payload: ICustomerRegisterRequestDTO = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      acceptTerms: req.body.acceptTerms,
      marketingOptIn: req.body.marketingOptIn,
    };

    const result = await CustomerService.customerRegisterRequest(payload);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "OTP sent to your email for verification",
      data: result,
    });
  },
);

export const CustomerController = { CustomerRegisterRequest };
