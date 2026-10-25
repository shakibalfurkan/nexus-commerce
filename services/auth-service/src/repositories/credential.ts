import type { UserRoles } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";

export async function findByEmail(email: string) {
  return prisma.credential.findUnique({
    where: { email },
  });
}

export async function findById(id: string) {
  return prisma.credential.findUnique({
    where: { id },
  });
}

export async function markDeleted(id: string, deletedAt: Date): Promise<void> {
  await prisma.credential.updateMany({
    where: { id },
    data: { isDeleted: true, deletedAt },
  });
}

export async function markRestored(id: string): Promise<void> {
  await prisma.credential.updateMany({
    where: { id },
    data: { isDeleted: false, deletedAt: null },
  });
}

export async function addRoleIfUnchanged(
  id: string,
  role: UserRoles,
  expectedRoles: UserRoles[],
): Promise<boolean> {
  const result = await prisma.credential.updateMany({
    where: { id, role: { equals: expectedRoles } },
    data: { role: Array.from(new Set([...expectedRoles, role])) },
  });

  return result.count === 1;
}

export async function existsSuperAdmin(): Promise<boolean> {
  const count = await prisma.credential.count({
    where: { role: { has: "SUPER_ADMIN" } },
  });
  return count > 0;
}
