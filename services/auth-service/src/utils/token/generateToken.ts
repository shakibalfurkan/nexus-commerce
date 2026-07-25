import jwt from "jsonwebtoken";
import type { UserRoles } from "../../generated/prisma/enums.js";

export interface ITokenPayload {
  id: string;
  role: UserRoles[];
  email: string;
  tokenType?: "access" | "refresh" | "reset";
}

export const generateToken = (
  jwtPayload: ITokenPayload,
  secret: string,
  expiresIn: string,
): string => {
  const token = jwt.sign(jwtPayload, secret, { expiresIn } as jwt.SignOptions);
  return token;
};
