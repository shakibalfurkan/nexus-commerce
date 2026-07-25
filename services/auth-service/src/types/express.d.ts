import type { UserRoles } from "../generated/prisma/enums.js";

type TUser = {
  id: string;
  email: string;
  role: UserRoles;
};

declare global {
  namespace Express {
    interface Request {
      user?: TUser;
      requestId: string;
    }
  }
}

export {};
