import { prisma } from "../../lib/prisma.js";
import type { AdminProfile } from "../../generated/prisma/client.js";

// ─── Types ───

export interface UpdateAdminProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatar?: string | null;
}

// ─── Public Repository API ───

export async function findByUserId(
  userId: string,
): Promise<AdminProfile | null> {
  return prisma.adminProfile.findUnique({
    where: { userId },
  });
}

export async function updateByUserId(
  userId: string,
  data: UpdateAdminProfileData,
): Promise<AdminProfile> {
  return prisma.adminProfile.update({
    where: { userId },
    data,
  });
}

export async function deleteByUserId(userId: string): Promise<void> {
  await prisma.adminProfile.delete({ where: { userId } });
}
