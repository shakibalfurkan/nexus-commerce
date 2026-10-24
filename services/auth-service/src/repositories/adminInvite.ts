import { prisma } from "../lib/prisma.js";
import type { PrismaTransaction } from "../types/database.types.js";
import { AdminInviteStatus } from "../generated/prisma/enums.js";

/**
 * Admin invite data access.
 *
 * Persisted in PostgreSQL (not Redis) because invites are an audit trail — who
 * invited, when, and the status history all matter, and volume is too low for
 * Redis's performance to justify losing that trail. Redis stays scoped to
 * refresh tokens / password resets.
 *
 * Only the sha256 hash of the invite token is stored; the raw token exists only
 * in the emailed link (same discipline as refresh tokens).
 */

export async function create(
  data: {
    email: string;
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
  },
  tx?: PrismaTransaction,
): Promise<{ id: string }> {
  const client = tx ?? prisma;

  return client.adminInvite.create({
    data: {
      email: data.email,
      tokenHash: data.tokenHash,
      invitedById: data.invitedById,
      expiresAt: data.expiresAt,
    },
    select: { id: true },
  });
}

export async function findByTokenHash(tokenHash: string) {
  return prisma.adminInvite.findUnique({
    where: { tokenHash },
  });
}

/**
 * Single-use consumption. Filtering on `status: PENDING` inside `updateMany`
 * makes "consume" atomic: a second accept of the same token updates 0 rows
 * instead of creating a second admin account.
 */
export async function markConsumed(
  id: string,
  consumedById: string,
  tx?: PrismaTransaction,
): Promise<boolean> {
  const client = tx ?? prisma;

  const result = await client.adminInvite.updateMany({
    where: { id, status: AdminInviteStatus.PENDING },
    data: {
      status: AdminInviteStatus.CONSUMED,
      consumedAt: new Date(),
      consumedById,
    },
  });

  return result.count === 1;
}

/**
 * Compensation path: the invite was marked CONSUMED but account provisioning
 * failed, so the token goes back to PENDING and stays usable. Guarded by
 * `consumedById` so it can only undo the consumption it is rolling back.
 */
export async function reopen(
  id: string,
  consumedById: string,
  tx?: PrismaTransaction,
): Promise<boolean> {
  const client = tx ?? prisma;

  const result = await client.adminInvite.updateMany({
    where: { id, status: AdminInviteStatus.CONSUMED, consumedById },
    data: {
      status: AdminInviteStatus.PENDING,
      consumedAt: null,
      consumedById: null,
    },
  });

  return result.count === 1;
}

/** Lazily flips an expired pending invite so status history stays truthful. */
export async function markExpired(id: string): Promise<void> {
  await prisma.adminInvite.updateMany({
    where: { id, status: AdminInviteStatus.PENDING },
    data: { status: AdminInviteStatus.EXPIRED },
  });
}
