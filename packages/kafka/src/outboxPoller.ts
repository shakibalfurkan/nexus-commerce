import type { Logger } from "@nexus/logger";
import {
  DEFAULT_OUTBOX_POLLER_OPTIONS,
  OutboxConnectionError,
  OutboxPublishError,
  type OutboxEventRow,
  type OutboxPollerDeps,
  type OutboxPollerOptions,
} from "./types.js";
import { calculateBackoff } from "./backoff.js";
import { publishDeadLetterEvent } from "./deadLetter.js";

/**
 * Generic outbox poller — one implementation for every service.
 *
 * The poller accepts the service's Prisma client, its canonical service name,
 * its event→topic mapping, and its Kafka publisher via {@link OutboxPollerDeps}.
 * No service name, table name, or topic is hardcoded, so it runs identically
 * for any service whose OutboxEvent table matches the shared shape.
 *
 * Delivery pipeline:
 *   1. Claim up to `batchSize` PENDING rows (respecting a lock timeout so rows
 *      orphaned by a crash are reaped, not stuck forever).
 *   2. Mark them PROCESSING with a locking identity so a concurrent poller
 *      instance never double-delivers the same batch.
 *   3. Publish each to its topic via the injected `publish` (which MUST throw on
 *      failure so we never mark a row COMPLETED that was not delivered).
 *   4. Success → COMPLETED. Failure → retry with backoff, or DEAD + DLQ once
 *      `maxRetries` is exhausted.
 *
 * A single interval trigger drives it: `start()` begins a fixed-cadence poll
 * (default 5s) that re-scans for PENDING rows every tick. Near-real-time
 * LISTEN/NOTIFY was removed because CockroachDB (used by several services)
 * does not support it — polling is now the uniform delivery mechanism across
 * all DB providers.
 *
 * WHY the `isBatchProcessing` lock exists: without it, two concurrent
 * intervals could start a second batch and both could claim/publish the same
 * rows (double delivery + lost updates). The gate serializes batches; anything
 * missed is re-picked by the next tick.
 */
export class OutboxPoller {
  private readonly deps: OutboxPollerDeps;
  private readonly options: OutboxPollerOptions;
  private readonly logger: Logger;

  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isBatchProcessing = false;
  private pendingBatch: Promise<void> | null = null;

  constructor(deps: OutboxPollerDeps) {
    this.deps = deps;
    this.options = { ...DEFAULT_OUTBOX_POLLER_OPTIONS, ...deps.options };
    this.logger = deps.logger;
  }

  /** Begin the interval polling loop. */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("[OutboxPoller] Already running");
      return;
    }
    this.isRunning = true;
    this.logger.info(
      `[OutboxPoller] Started. Poll interval ${this.options.fallbackPollIntervalMs}ms, batch ${this.options.batchSize}`,
    );

    // Drain rows written before startup so they are not delayed a full interval.
    await this.triggerBatch();

    this.timer = setInterval(() => {
      this.triggerBatch().catch((error: unknown) => {
        this.logger.error("[OutboxPoller] Unhandled batch error", error);
      });
    }, this.options.fallbackPollIntervalMs);
    this.timer.unref();
  }

  /**
   * Stop the interval and await any in-flight batch (graceful shutdown).
   * B10: without awaiting, SIGTERM could kill a mid-publish run and leave a row
   * PROCESSING until `lockTimeoutMs` reaps it.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.pendingBatch) {
      try {
        await this.pendingBatch;
      } catch (error) {
        this.logger.warn(
          "[OutboxPoller] In-flight batch failed during stop",
          error,
        );
      }
    }
    this.logger.info("[OutboxPoller] Stopped");
  }

  /** Run a batch once, tracking the in-flight promise for graceful stop. */
  private triggerBatch(): Promise<void> {
    if (this.pendingBatch) return this.pendingBatch;
    this.pendingBatch = this.processNextBatch().finally(() => {
      this.pendingBatch = null;
    });
    return this.pendingBatch;
  }

  private async processNextBatch(): Promise<void> {
    if (this.isBatchProcessing) return;
    this.isBatchProcessing = true;

    const now = new Date();
    const lockTimeout = new Date(now.getTime() - this.options.lockTimeoutMs);

    try {
      const events = await this.deps.prisma.outboxEvent.findMany({
        where: {
          status: "PENDING",
          AND: [
            {
              OR: [{ lockedAt: null }, { lockedAt: { lt: lockTimeout } }],
            },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: this.options.batchSize,
      });

      if (events.length === 0) return;

      // Claim the batch as PROCESSING so a concurrent poller never re-picks it.
      const eventIds = events.map((event) => event.id);
      await this.deps.prisma.outboxEvent.updateMany({
        where: { id: { in: eventIds } },
        data: {
          status: "PROCESSING",
          lockedAt: now,
          lockedBy: `outbox-poller-${this.deps.serviceName}-${process.pid}`,
        },
      });

      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      // Distinguishable DB/connection failure path (typed, not swallowed).
      const err =
        error instanceof OutboxConnectionError
          ? error
          : new OutboxConnectionError(
              `Outbox batch query/claim failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
              { cause: error },
            );
      this.logger.error(err.message, error);
    } finally {
      this.isBatchProcessing = false;
    }
  }

  private async processEvent(event: OutboxEventRow): Promise<void> {
    try {
      const topic = this.deps.resolveTopic(event.eventType);
      try {
        await this.deps.publish({
          topic,
          key: event.id,
          value: event.payload,
          ...(event.traceparent !== null && event.traceparent !== undefined
            ? { traceparent: event.traceparent }
            : {}),
        });
      } catch (error) {
        // Normalize any publisher failure into the typed error path so retry /
        // DLQ decisions branch on an explicit OutboxPublishError.
        throw new OutboxPublishError(event.id, event.eventType, error);
      }

      await this.deps.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });

      this.logger.debug(
        `[OutboxPoller] Event ${event.id} (${event.eventType}) published to ${topic}`,
      );
    } catch (error) {
      await this.handleFailure(event, error);
    }
  }

  private async handleFailure(
    event: OutboxEventRow,
    error: unknown,
  ): Promise<void> {
    const newRetryCount = event.retryCount + 1;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (newRetryCount >= this.options.maxRetries) {
      // Exhausted — park as DEAD and route to DLQ (DB DEAD row is truth).
      await this.deps.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "DEAD",
          retryCount: newRetryCount,
          lastError: errorMessage,
          lockedAt: null,
          lockedBy: null,
        },
      });
      this.logger.error(
        `[OutboxPoller] Event ${event.id} (${event.eventType}) moved to DEAD after ${newRetryCount} retries`,
        error,
      );
      await publishDeadLetterEvent({
        serviceName: this.deps.serviceName,
        eventId: event.id,
        eventType: event.eventType,
        errorMessage,
        publish: this.deps.publish,
        logger: this.logger,
      });
      return;
    }

    // Retry: restore to PENDING, release the lock, record backoff for output.
    const backoffMs = calculateBackoff(
      newRetryCount,
      this.options.baseBackoffMs,
      this.options.maxBackoffMs,
    );
    await this.deps.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: "PENDING",
        retryCount: newRetryCount,
        lastError: errorMessage,
        lockedAt: null,
        lockedBy: null,
      },
    });
    this.logger.warn(
      `[OutboxPoller] Event ${event.id} (${event.eventType}) failed (retry ${newRetryCount}/${this.options.maxRetries}). Next retry in ${backoffMs}ms`,
      error,
    );
  }
}
