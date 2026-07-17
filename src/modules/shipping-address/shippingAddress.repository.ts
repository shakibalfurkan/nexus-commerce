import { prisma } from "../../lib/prisma.js";
import type { ShippingAddress } from "../../generated/prisma/client.js";
import type { CursorPaginationResult } from "../../types/database.types.js";
import {
  decodeCursor,
  buildCursorWhere,
  paginateResult,
} from "../../pagination/cursorPagination.js";

// ─── Types ───

export interface CreateShippingAddressData {
  recipientName: string;
  street: string;
  apartment?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
  label?: string | null;
}

export interface UpdateShippingAddressData {
  recipientName?: string;
  street?: string;
  apartment?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
  label?: string | null;
}

// ─── Public Repository API ───

export async function findById(id: string): Promise<ShippingAddress | null> {
  return prisma.shippingAddress.findUnique({
    where: { id },
  });
}

export async function findByProfileId(
  profileId: string,
): Promise<ShippingAddress[]> {
  return prisma.shippingAddress.findMany({
    where: { profileId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function listByProfileId(
  profileId: string,
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginationResult<ShippingAddress>> {
  const take = limit + 1;

  const where: Record<string, unknown> = { profileId };

  let cursorWhere: Record<string, unknown> = {};
  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    cursorWhere = buildCursorWhere(decodedCursor, where);
  } else {
    cursorWhere = where;
  }

  const addresses = await prisma.shippingAddress.findMany({
    where: cursorWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
  });

  return paginateResult(addresses, limit);
}

export async function create(
  profileId: string,
  data: CreateShippingAddressData,
): Promise<ShippingAddress> {
  // If this is the first address or marked as default, unset other defaults
  if (data.isDefault) {
    await prisma.shippingAddress.updateMany({
      where: { profileId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.shippingAddress.create({
    data: {
      profileId,
      recipientName: data.recipientName,
      street: data.street,
      apartment: data.apartment ?? null,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      isDefault: data.isDefault ?? false,
      label: data.label ?? null,
    },
  });
}

export async function updateById(
  id: string,
  data: UpdateShippingAddressData,
): Promise<ShippingAddress> {
  // If marking as default, unset other defaults for this profile
  if (data.isDefault) {
    const existing = await prisma.shippingAddress.findUnique({
      where: { id },
      select: { profileId: true },
    });
    if (existing) {
      await prisma.shippingAddress.updateMany({
        where: {
          profileId: existing.profileId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }
  }

  return prisma.shippingAddress.update({
    where: { id },
    data,
  });
}

export async function deleteById(id: string): Promise<void> {
  await prisma.shippingAddress.delete({ where: { id } });
}

export async function countByProfileId(profileId: string): Promise<number> {
  return prisma.shippingAddress.count({ where: { profileId } });
}
