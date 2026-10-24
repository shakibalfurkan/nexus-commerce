import type { PrismaTransaction } from "../types/database.types.js";
import type { Prisma } from "../generated/prisma/client.js";

/**
 * auth-service audit trail writer — one place that knows the AuditLog row
 * shape, so invite creation/consumption, role sync and tamper detection all
 * record the same fields.
 *
 * `client` is either the global `prisma` client or a transaction client, so a
 * caller inside `prisma.$transaction` keeps the audit entry atomic with the
 * business write.
 */
export interface AuditLogInput {
  actorId: string;
  action: string;
  targetId: string;
  targetType: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function writeAuditLog(
  client: PrismaTransaction,
  input: AuditLogInput,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetId: input.targetId,
      targetType: input.targetType,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      ...(input.oldValues !== undefined ? { oldValues: input.oldValues } : {}),
      ...(input.newValues !== undefined ? { newValues: input.newValues } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
