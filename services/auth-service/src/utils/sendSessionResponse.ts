import type { Response } from "express";
import sendResponse from "./sendResponse.js";
import { setCookie } from "./cookieHandler.js";
import type { IAuthResult } from "../modules/auth/auth.interface.js";

const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Single place that decides how a session is handed to the caller:
 *
 *  - the customer storefront is server-rendered and keeps tokens in its own
 *    origin, so it receives them in the body;
 *  - the seller/admin dashboards are SPAs and receive httpOnly cookies
 *    (tokens never touch JS).
 *
 * Every role controller goes through this so the cookie/body contract cannot
 * drift between surfaces.
 */
export function sendSessionResponse(
  res: Response,
  options: {
    result: IAuthResult;
    clientType: string | undefined;
    statusCode: number;
    message: string;
  },
): void {
  const { result, clientType, statusCode, message } = options;
  const { accessToken, refreshToken, ...credentialData } = result;
  const tokensInBody = clientType === "customer-web";

  if (!tokensInBody) {
    if (accessToken) {
      setCookie(res, "accessToken", accessToken, ACCESS_TOKEN_MAX_AGE_MS);
    }
    if (refreshToken) {
      setCookie(res, "refreshToken", refreshToken, REFRESH_TOKEN_MAX_AGE_MS);
    }
  }

  sendResponse(res, {
    statusCode,
    success: true,
    message,
    data: {
      ...credentialData,
      ...(tokensInBody && accessToken ? { accessToken } : {}),
      ...(tokensInBody && refreshToken ? { refreshToken } : {}),
    },
  });
}
