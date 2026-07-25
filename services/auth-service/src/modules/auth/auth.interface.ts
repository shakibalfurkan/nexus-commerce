import type { UserRoles } from "../../generated/prisma/enums.js";

export interface IRegisterRequestDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "SELLER" | "CUSTOMER";
}

export interface IVerifyRegistrationDTO {
  email: string;
  otp: string;
}

export interface IResendOtpDTO {
  email: string;
}

export interface ILoginDTO {
  email: string;
  password: string;
  role: "customer" | "seller" | "admin";
}

export interface IAuthResult {
  id: string;
  email: string;
  role: UserRoles[];
  accessToken?: string;
  refreshToken?: string;
}

export interface ITokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  role: UserRoles[];
}
