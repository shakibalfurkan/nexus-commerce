import type { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync.js";
import type { UserRoles } from "../generated/prisma/enums.js";
import { UnauthorizedError } from "../errors/AppError.js";
import type { JwtPayload } from "jsonwebtoken";
import config from "../config/index.js";
import verifyToken from "../utils/token/verifyToken.js";

export const auth = (
  ...requiredRoles: (typeof UserRoles)[keyof typeof UserRoles][]
) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token =
      req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new UnauthorizedError("You are not authorized!");
    }

    const decodedToken = verifyToken(
      token,
      config.jwt.access_token_secret!,
    ) as JwtPayload;

    const { id, email, role } = decodedToken;

    const user = await User.findOne({ email });

    if (!user) {
      throw new UnauthorizedError("You are not authorized!");
    }

    if (!requiredRoles.includes(role)) {
      return AuthError(req, res);
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role,
    };

    next();
  });
};
