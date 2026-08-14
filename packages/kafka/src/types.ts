import type { Logger } from "@nexus/logger";

/**
 * Shared types for the Nexus outbox pipeline.
 *
 * These types are intentionally framework-agnostic: the poller depends on a
 * narrow `outboxEvent` delegate (structurally matched by each service's Prisma
 * client) rather than the full `PrismaClient`. Because every service that uses
 * the outbox pattern has an identical `OutboxEvent` table shape, one generic
 * implementation works for all of them without modification.
 */

// ─── Outbox event status ───

export type OutboxStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "DEAD";

/** Minimal row shape the poller reads and writes on the OutboxEvent table. */
export interface OutboxEventRow {
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

export interface OutboxPollerOptions {
  /**
   * Slow safety-net poll interval (ms). The Postgres LISTEN/NOTIFY listener is
   * the PRIMARY trigger; this interval is the FALLBACK that catches events
   * written while the listener is disconnected (NOTIFY is fire-and-forget and
   * drops messages sent while no listener is subscribed). Default 30s.
   */
  fallbackPollIntervalMs: number;
  /** Max events claimed per batch. */
  batchSize: number;
  /** Base delay for exponential retry backoff (ms). */
  baseBackoffMs: number;
  /** Upper cap for retry backoff (ms). */
  maxBackoffMs: number;
  /** Max delivery attempts before an event is marked DEAD and routed to DLQ. */
  maxRetries: number;
  /** How long a claimed-but-unfinished row stays locked before it is reaped. */
  lockTimeoutMs: number;
  /**
   * Minimum gap (ms) between listener-triggered batch polls. NOTIFY is
   * fire-and-forget and a burst of inserts can fire many notifications; this
   * throttles them into a single wake-up (the poll query drains all PENDING
   * rows regardless). Default 500ms.
   */
  minNotifyIntervalMs: number;
}

export const DEFAULT_OUTBOX_POLLER_OPTIONS: OutboxPollerOptions = {
  fallbackPollIntervalMs: 30_000,
  batchSize: 100,
  baseBackoffMs: 1_000,
  maxBackoffMs: 60_000,
  maxRetries: 5,
  lockTimeoutMs: 30_000,
  minNotifyIntervalMs: 500,
};

/**
 * NOTE on `maxRetries`: the poller decides DEAD from OPTIONS (never the
 * OutboxEvent `maxRetries` COLUMN). The column is written by outboxWriter as
 * metadata and is intentionally ignored, so there is a single source of truth
 * — the poller options. Do not add a second mechanism reading the column.
 */

// ─── Prisma `outboxEvent` delegate shapes ───
// These must remain valid Prisma `OutboxEvent` query/update inputs so each
// service's generated client is structurally assignable without coercion.

export interface OutboxFindManyArgs {
  where: {
    status: "PENDING";
    AND: Array<{ OR: Array<{ lockedAt: null } | { lockedAt: { lt: Date } }> }>;
  };
  orderBy: { createdAt: "asc" };
  take: number;
}

export interface OutboxUpdateManyArgs {
  where: { id: { in: string[] } };
  data: { status: "PROCESSING"; lockedAt: Date; lockedBy: string };
}

export interface OutboxUpdateArgs {
  where: { id: string };
  data:
    | {
        status: "COMPLETED";
        processedAt: Date;
        lockedAt: null;
        lockedBy: null;
      }
    | {
        status: "PENDING";
        retryCount: number;
        lastError: string;
        lockedAt: null;
        lockedBy: null;
      }
    | {
        status: "DEAD";
        retryCount: number;
        lastError: string;
        lockedAt: null;
        lockedBy: null;
      };
}

/** Narrow structural view of a Prisma `outboxEvent` delegate. */
export interface OutboxEventDelegate {
  findMany(args: OutboxFindManyArgs): Promise<OutboxEventRow[]>;
  updateMany(args: OutboxUpdateManyArgs): Promise<{ count: number }>;
  update(args: OutboxUpdateArgs): Promise<OutboxEventRow>;
}

/** The slice of the Prisma client the poller needs. */
export interface OutboxEventDb {
  outboxEvent: OutboxEventDelegate;
}

// ─── Publish / topic routing dependencies ───

export interface OutboxPublishParams {
  topic: string;
  key: string;
  value: unknown;
  traceparent?: string;
}

/** MUST reject (throw) on Kafka failure so the retry/DLQ path is exercised. */
export type OutboxPublishFn = (params: OutboxPublishParams) => Promise<void>;

/** Routes an event type string to its Kafka topic. Service-specific mapping. */
export type TopicResolver = (eventType: string) => string;

export interface OutboxPollerDeps {
  /** Service's Prisma client (structurally matched to {@link OutboxEventDb}). */
  prisma: OutboxEventDb;
  /** Canonical service name — used for locking identity and DLQ `source`. */
  serviceName: string;
  /** Service-specific event type → Kafka topic mapping. */
  resolveTopic: TopicResolver;
  /** Kafka publisher; the outbox EventBus wiring lives in the service. */
  publish: OutboxPublishFn;
  /** Shared logger (never console.log). */
  logger: Logger;
  options?: Partial<OutboxPollerOptions>;
}

// ─── Typed error paths ───
// Distinct, explicitly-typed error classes so callers can branch on the cause
// (connection vs. malformed payload vs. Kafka publish) instead of catching a
// generic error and guessing.

/** Kafka publish for an outbox event failed — drives retry / DLQ. */
export class OutboxPublishError extends Error {
  readonly eventId: string;
  readonly eventType: string;

  constructor(eventId: string, eventType: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Outbox publish failed for event ${eventId} (${eventType}): ${message}`, {
      cause,
    });
    this.name = "OutboxPublishError";
    this.eventId = eventId;
    this.eventType = eventType;
  }
}

/** An outbox event row's payload could not be used (malformed payload). */
export class OutboxMalformedPayloadError extends Error {
  readonly eventId: string;

  constructor(eventId: string, message: string) {
    super(`Malformed outbox payload for event ${eventId}: ${message}`);
    this.name = "OutboxMalformedPayloadError";
    this.eventId = eventId;
  }
}

/** The poller could not reach/query its database (connection failure). */
export class OutboxConnectionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OutboxConnectionError";
  }
}
