import jwt, { type JwtPayload } from "jsonwebtoken";
import { UserRoles } from "../../generated/prisma/enums.js";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@nexus/errors";

export interface ITokenPayload {
  id: string;
  role: UserRoles[];
  email: string;
  tokenType?: "access" | "refresh" | "reset";
}

export interface IDecodedToken extends ITokenPayload, JwtPayload {
  iat: number;
  exp: number;
}

const verifyToken = (
  token: string,
  secret: string,
  expectedType?: "access" | "refresh",
): IDecodedToken => {
  if (!token) {
    throw new UnauthorizedError("No token provided");
  }

  if (!secret) {
    throw new BadRequestError("JWT secret is not configured");
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as IDecodedToken;

    if (expectedType && decoded.tokenType !== expectedType) {
      throw new ForbiddenError(
        `Invalid token type. Expected ${expectedType} token`,
      );
    }

    return decoded;
  } catch (error: any) {
    throw new UnauthorizedError(error.message);
  }
};

export default verifyToken;
