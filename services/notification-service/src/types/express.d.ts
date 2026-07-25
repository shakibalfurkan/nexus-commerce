import type { UserRoles } from "../generated/prisma/enums.ts";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export {};
