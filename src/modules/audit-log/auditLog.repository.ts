import { prisma } from "../../lib/prisma.js";
import type { CursorPaginationResult } from "../../types/database.types.js";
import {
  decodeCursor,
  buildCursorWhere,
  paginateResult,
} from "../../pagination/cursorPagination.js";

// ─── Types ───

export interface CreateAuditLogData {
  actorId: string;
  action: string;
  targetId: string;
  targetType: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListAuditLogFilters {
  actorId?: string;
  targetId?: string;
  targetType?: string;
  action?: string;
}

// ─── Public Repository API ───

export async function findById(id: string) {
  return prisma.auditLog.findUnique({ where: { id } });
}

export async function listByActor(
  actorId: string,
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginationResult<unknown>> {
  return listWithFilters({ actorId }, cursor, limit);
}

export async function listByTarget(
  targetId: string,
  targetType: string,
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginationResult<unknown>> {
  return listWithFilters({ targetId, targetType }, cursor, limit);
}

export async function listByAction(
  action: string,
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginationResult<unknown>> {
  return listWithFilters({ action }, cursor, limit);
}

export async function listWithFilters(
  filters: ListAuditLogFilters,
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginationResult<unknown>> {
  const take = limit + 1;

  const where: Record<string, unknown> = {};
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.targetId) where.targetId = filters.targetId;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.action) where.action = filters.action;

  let cursorWhere: Record<string, unknown> = {};
  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    cursorWhere = buildCursorWhere(decodedCursor, where);
  } else {
    cursorWhere = where;
  }

  const logs = await prisma.auditLog.findMany({
    where: cursorWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
  });

  return paginateResult(logs, limit);
}

export async function create(data: CreateAuditLogData): Promise<unknown> {
  return prisma.auditLog.create({
    data: {
      actorId: data.actorId,
      action: data.action,
      targetId: data.targetId,
      targetType: data.targetType,
      oldValues: (data.oldValues as any) ?? undefined,
      newValues: (data.newValues as any) ?? undefined,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      metadata: (data.metadata as any) ?? undefined,
    },
  });
}
