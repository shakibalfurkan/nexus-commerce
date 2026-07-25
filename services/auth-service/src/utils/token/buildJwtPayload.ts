import type { UserRoles } from "../../generated/prisma/enums.js";

export function buildJwtPayload(payload: {
  id: string;
  email: string;
  role: UserRoles[];
  activeRole: UserRoles;
}) {
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    activeRole: payload.activeRole,
  };
}
