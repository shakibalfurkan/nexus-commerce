import { prisma } from "../lib/prisma.js";
import logger from "../utils/logger.js";

// ─── Public API ───

export async function getDeadLetterEvents(
  limit = 50,
  offset = 0,
): Promise<
  Array<{
    id: string;
    aggregateId: string;
    eventType: string;
    retryCount: number;
    lastError: string | null;
    createdAt: Date;
  }>
> {
  const events = await prisma.outboxEvent.findMany({
    where: { status: "DEAD" },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      aggregateId: true,
      eventType: true,
      retryCount: true,
      lastError: true,
      createdAt: true,
    },
  });

  return events;
}

export async function retryDeadEvent(eventId: string): Promise<void> {
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

  logger.info(`[OutboxDLQ] Event ${eventId} reset to PENDING for retry`);
}

export async function retryAllDeadEvents(): Promise<number> {
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

  logger.info(`[OutboxDLQ] Retried ${result.count} events from DLQ`);
  return result.count;
}

export async function discardDeadEvent(eventId: string): Promise<void> {
  await prisma.outboxEvent.delete({
    where: { id: eventId },
  });

  logger.warn(`[OutboxDLQ] Event ${eventId} permanently discarded`);
}

export async function getDeadLetterCount(): Promise<number> {
  return prisma.outboxEvent.count({
    where: { status: "DEAD" },
  });
}
