import { prisma } from "../../lib/prisma.js";
import type { SellerProfile } from "../../generated/prisma/client.js";

// ─── Types ───

export interface UpdateSellerProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatar?: string | null;
  shopName?: string;
  shopEmail?: string;
  shopPhone?: string;
  stripeConnectId?: string | null;
  onboardingComplete?: boolean;
  commissionRate?: number;
  totalProducts?: number;
  salesCount?: number;
  totalRevenue?: number;
  rating?: number;
  reviewCount?: number;
}

// ─── Public Repository API ───

export async function findByUserId(
  userId: string,
): Promise<(SellerProfile & { shopAddresses: unknown[] }) | null> {
  return prisma.sellerProfile.findUnique({
    where: { userId },
    include: { shopAddresses: true },
  });
}

export async function findByShopName(
  shopName: string,
): Promise<SellerProfile | null> {
  return prisma.sellerProfile.findUnique({
    where: { shopName },
  });
}

export async function updateByUserId(
  userId: string,
  data: UpdateSellerProfileData,
): Promise<SellerProfile> {
  return prisma.sellerProfile.update({
    where: { userId },
    data,
    include: { shopAddresses: true },
  });
}

export async function deleteByUserId(userId: string): Promise<void> {
  await prisma.sellerProfile.delete({ where: { userId } });
}
