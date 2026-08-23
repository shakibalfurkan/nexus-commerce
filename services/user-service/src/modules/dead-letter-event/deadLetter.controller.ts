import type { Request, Response } from "express";
import { NotFoundError } from "@nexus/errors";
import { KafkaTopics } from "@nexus/event-contracts";
import * as repository from "./deadLetterEvent.repository.js";
import { eventBus } from "../../events/eventBus.js";
import logger from "../../utils/logger.js";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { parsePaginationParams } from "../../pagination/cursorPagination.js";

/**
 * GET /admin/dead-letters
 * Cursor-paginated list, filterable by sourceService and/or eventType.
 */
const listDeadLetters = catchAsync(async (req: Request, res: Response) => {
  const sourceService =
    typeof req.query.sourceService === "string" && req.query.sourceService
      ? req.query.sourceService
      : undefined;
  const eventType =
    typeof req.query.eventType === "string" && req.query.eventType
      ? req.query.eventType
      : undefined;
  const cursorParam = req.query.cursor;

  const pagination = parsePaginationParams({
    limit: typeof req.query.limit === "string" ? Number(req.query.limit) : 20,
  });
  const cursor = typeof cursorParam === "string" ? cursorParam : undefined;

  const result = await repository.list(
    {
      ...(sourceService ? { sourceService } : {}),
      ...(eventType ? { eventType } : {}),
    },
    cursor,
    pagination.limit,
  );

  // sendResponse's single generic covers both `data` and `meta`; our meta
  // differs from data's row type, so one boundary cast here.
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dead-letter events retrieved",
    data: result.data,
    meta: {
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
  } as never);
});

/**
 * POST /admin/dead-letters/:id/redrive
 * Manual redrive (the only permitted path for payment/order domains).
 * Republishes the preserved raw payload to the domain-events topic so normal
 * consumers retry it. The row is kept for audit; redrive count/history lives
 * in logs.
 */
const redriveDeadLetter = catchAsync(async (req: Request, res: Response) => {
  const record = await repository.findById(req.params.id as string);

  if (!record) {
    throw new NotFoundError("Dead-letter event not found", "id");
  }

  if (!record.payload) {
    throw new NotFoundError(
      "No payload snapshot preserved for this event — manual replay impossible",
      "payload",
    );
  }

  if (!eventBus) {
    throw new Error("Kafka not configured — cannot redrive");
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(record.payload as string);
  } catch {
    parsedPayload = record.payload;
  }

  await eventBus.publish({
    topic: KafkaTopics.DOMAIN_EVENTS,
    key: record.eventId,
    value: parsedPayload,
    ...(record.traceparent ? { traceparent: record.traceparent } : {}),
  });

  logger.info("Dead-letter event re-driven by admin", {
    id: record.id,
    sourceService: record.sourceService,
    eventId: record.eventId,
    eventType: record.eventType,
    actorId: req.user?.id,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dead-letter event republished to domain-events",
    data: { id: record.id },
  });
});

export const DeadLetterController = { listDeadLetters, redriveDeadLetter };
