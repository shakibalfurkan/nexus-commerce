import { prisma } from "../../lib/prisma.js";
import type { CustomerProfile } from "../../generated/prisma/client.js";

// ─── Types ───

export interface UpdateCustomerProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatar?: string | null;
  dateOfBirth?: Date | null;
}

// ─── Public Repository API ───

export async function findByUserId(
  userId: string,
): Promise<CustomerProfile | null> {
  return prisma.customerProfile.findUnique({
    where: { userId },
    include: { shippingAddresses: true },
  });
}

export async function updateByUserId(
  userId: string,
  data: UpdateCustomerProfileData,
): Promise<CustomerProfile> {
  return prisma.customerProfile.update({
    where: { userId },
    data,
    include: { shippingAddresses: true },
  });
}

export async function deleteByUserId(userId: string): Promise<void> {
  await prisma.customerProfile.delete({ where: { userId } });
}
