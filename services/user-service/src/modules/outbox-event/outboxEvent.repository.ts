import { prisma } from "../../lib/prisma.js";
import type { CursorPaginationResult } from "../../types/database.types.js";
import {
  decodeCursor,
  buildCursorWhere,
  paginateResult,
} from "../../pagination/cursorPagination.js";

// ─── Types ───

export type OutboxStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "DEAD";

export interface OutboxEventRecord {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  traceparent: string | null;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

export interface CreateOutboxEventData {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  traceparent?: string | null;
}

// ─── Public Repository API ───

export async function findById(id: string): Promise<OutboxEventRecord | null> {
  return prisma.outboxEvent.findUnique({
    where: { id },
  }) as Promise<OutboxEventRecord | null>;
}

export async function create(
  data: CreateOutboxEventData,
): Promise<OutboxEventRecord> {
  return prisma.outboxEvent.create({
    data: {
      id: data.id,
      aggregateId: data.aggregateId,
      eventType: data.eventType,
      payload: data.payload as any,
      traceparent: data.traceparent ?? null,
      status: "PENDING",
      retryCount: 0,
      maxRetries: 5,
    },
  }) as Promise<OutboxEventRecord>;
}

// ─── DLQ Queries (cursor-paginated) ───

export async function listDeadEvents(
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginationResult<OutboxEventRecord>> {
  return listByStatus("DEAD", cursor, limit);
}

export async function listByStatus(
  status: OutboxStatus,
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginationResult<OutboxEventRecord>> {
  const take = limit + 1;

  const where: Record<string, unknown> = { status };

  let cursorWhere: Record<string, unknown> = {};
  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    cursorWhere = buildCursorWhere(decodedCursor, where);
  } else {
    cursorWhere = where;
  }

  const events = await prisma.outboxEvent.findMany({
    where: cursorWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
  });

  return paginateResult(events, limit);
}

export async function resetToPending(eventId: string): Promise<void> {
  await prisma.outboxEvent.update({
    where: { id: eventId },
    data: {
      status: "PENDING",
      retryCount: 0,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function resetAllDeadToPending(): Promise<number> {
  const result = await prisma.outboxEvent.updateMany({
    where: { status: "DEAD" },
    data: {
      status: "PENDING",
      retryCount: 0,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
    },
  });
  return result.count;
}

export async function discardById(eventId: string): Promise<void> {
  await prisma.outboxEvent.delete({ where: { id: eventId } });
}

export async function countByStatus(status: OutboxStatus): Promise<number> {
  return prisma.outboxEvent.count({ where: { status } });
}
