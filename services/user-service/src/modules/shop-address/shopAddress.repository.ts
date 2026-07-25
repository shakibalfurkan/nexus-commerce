import { prisma } from "../../lib/prisma.js";
import type { ShopAddress } from "../../generated/prisma/client.js";
import type { CursorPaginationResult } from "../../types/database.types.js";
import {
  decodeCursor,
  buildCursorWhere,
  paginateResult,
} from "../../pagination/cursorPagination.js";

// ─── Types ───

export interface CreateShopAddressData {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat?: number | null;
  lng?: number | null;
  isPrimary?: boolean;
}

export interface UpdateShopAddressData {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
  isPrimary?: boolean;
}

// ─── Public Repository API ───

export async function findById(id: string): Promise<ShopAddress | null> {
  return prisma.shopAddress.findUnique({ where: { id } });
}

export async function findBySellerProfileId(
  sellerProfileId: string,
): Promise<ShopAddress[]> {
  return prisma.shopAddress.findMany({
    where: { sellerProfileId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

export async function listBySellerProfileId(
  sellerProfileId: string,
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginationResult<ShopAddress>> {
  const take = limit + 1;

  const where: Record<string, unknown> = { sellerProfileId };

  let cursorWhere: Record<string, unknown> = {};
  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    cursorWhere = buildCursorWhere(decodedCursor, where);
  } else {
    cursorWhere = where;
  }

  const addresses = await prisma.shopAddress.findMany({
    where: cursorWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
  });

  return paginateResult(addresses, limit);
}

export async function findPrimaryBySellerProfileId(
  sellerProfileId: string,
): Promise<ShopAddress | null> {
  return prisma.shopAddress.findFirst({
    where: { sellerProfileId, isPrimary: true },
  });
}

export async function create(
  sellerProfileId: string,
  data: CreateShopAddressData,
): Promise<ShopAddress> {
  // If marking as primary, unset other primaries for this seller
  if (data.isPrimary) {
    await prisma.shopAddress.updateMany({
      where: { sellerProfileId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  // If this is the first address, auto-set as primary
  const existingCount = await prisma.shopAddress.count({
    where: { sellerProfileId },
  });

  return prisma.shopAddress.create({
    data: {
      sellerProfileId,
      street: data.street,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      isPrimary: existingCount === 0 ? true : (data.isPrimary ?? false),
    },
  });
}

export async function updateById(
  id: string,
  data: UpdateShopAddressData,
): Promise<ShopAddress> {
  // If marking as primary, unset other primaries for this seller
  if (data.isPrimary) {
    const existing = await prisma.shopAddress.findUnique({
      where: { id },
      select: { sellerProfileId: true },
    });
    if (existing) {
      await prisma.shopAddress.updateMany({
        where: {
          sellerProfileId: existing.sellerProfileId,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }
  }

  return prisma.shopAddress.update({
    where: { id },
    data,
  });
}

export async function deleteById(id: string): Promise<void> {
  // Fetch the address first to know the sellerProfileId
  const address = await prisma.shopAddress.findUnique({
    where: { id },
    select: { sellerProfileId: true, isPrimary: true },
  });

  await prisma.shopAddress.delete({ where: { id } });

  // If the deleted address was primary, assign the next oldest as primary
  if (address?.isPrimary) {
    const nextAddress = await prisma.shopAddress.findFirst({
      where: { sellerProfileId: address.sellerProfileId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (nextAddress) {
      await prisma.shopAddress.update({
        where: { id: nextAddress.id },
        data: { isPrimary: true },
      });
    }
  }
}

export async function countBySellerProfileId(
  sellerProfileId: string,
): Promise<number> {
  return prisma.shopAddress.count({ where: { sellerProfileId } });
}
