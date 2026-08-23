import { prisma } from "../../lib/prisma.js";
import {
  decodeCursor,
  buildCursorWhere,
  paginateResult,
} from "../../pagination/cursorPagination.js";
import type { Prisma } from "../../generated/prisma/client.js";

// ─── Types ───

export interface DeadLetterEventRecord {
  id: string;
  sourceService: string;
  eventId: string;
  eventType: string | null;
  failureStage: string;
  errorMessage: string;
  payload: unknown;
  traceparent: string | null;
  correlationId: string | null;
  createdAt: Date;
}

export interface ListDeadLetterEventsFilter {
  sourceService?: string;
  eventType?: string;
}

// ─── Repository API ───

export async function create(
  data: {
    sourceService: string;
    eventId: string;
    eventType: string | null;
    failureStage: string;
    errorMessage: string;
    payload?: unknown;
    traceparent?: string | undefined;
    correlationId?: string | undefined;
  },
): Promise<DeadLetterEventRecord> {
  const row = await prisma.deadLetterEvent.create({
    data: {
      sourceService: data.sourceService,
      eventId: data.eventId,
      eventType: data.eventType,
      failureStage: data.failureStage,
      errorMessage: data.errorMessage,
      ...(data.payload !== undefined
        ? { payload: data.payload as Prisma.InputJsonValue }
        : {}),
      ...(data.traceparent !== undefined ? { traceparent: data.traceparent } : {}),
      ...(data.correlationId !== undefined
        ? { correlationId: data.correlationId }
        : {}),
    },
  });
  return toRecord(row);
}

export async function findById(id: string): Promise<DeadLetterEventRecord | null> {
  const row = await prisma.deadLetterEvent.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

export async function list(
  filter: ListDeadLetterEventsFilter,
  cursor: string | undefined,
  limit: number,
) {
  const decoded = decodeCursor(cursor ?? "");

  const rows = await prisma.deadLetterEvent.findMany({
    where: buildCursorWhere(decoded, {
      ...(filter.sourceService ? { sourceService: filter.sourceService } : {}),
      ...(filter.eventType ? { eventType: filter.eventType } : {}),
    }),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  });

  return paginateResult(rows, limit);
}

function toRecord(row: {
  id: string;
  sourceService: string;
  eventId: string;
  eventType: string | null;
  failureStage: string;
  errorMessage: string;
  payload: unknown;
  traceparent: string | null;
  correlationId: string | null;
  createdAt: Date;
}): DeadLetterEventRecord {
  return {
    id: row.id,
    sourceService: row.sourceService,
    eventId: row.eventId,
    eventType: row.eventType,
    failureStage: row.failureStage,
    errorMessage: row.errorMessage,
    payload: row.payload,
    traceparent: row.traceparent,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
  };
}
