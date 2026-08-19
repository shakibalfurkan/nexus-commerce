import { afterEach, describe, expect, it, vi } from "vitest";
import { OutboxPoller } from "../src/outboxPoller.js";
import { KafkaTopics, DLQEventTypes } from "@nexus/event-contracts";
import type { Logger } from "@nexus/logger";
import type {
  OutboxEventDb,
  OutboxEventRow,
  OutboxUpdateArgs,
  OutboxUpdateManyArgs,
} from "../src/types.js";

const noopLog: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  http: vi.fn(),
};

type PublishCall = { topic: string; key: string; value: unknown };

function makeRow(overrides: Partial<OutboxEventRow> = {}): OutboxEventRow {
  return {
    id: "e-1",
    aggregateId: "agg-1",
    eventType: "user.registered",
    payload: { eventType: "user.registered", aggregateId: "agg-1" },
    traceparent: null,
    status: "PENDING",
    retryCount: 0,
    maxRetries: 5,
    lastError: null,
    lockedAt: null,
    lockedBy: null,
    processedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OutboxPoller", () => {
  it("publishes a pending event and marks it COMPLETED", async () => {
    const rows: OutboxEventRow[] = [makeRow()];
    const published: PublishCall[] = [];
    const updatedArgs: OutboxUpdateArgs[] = [];

    const db: OutboxEventDb = {
      outboxEvent: {
        findMany: async () => {
          // Return only the first PENDING row (simulate the poll).
          const row = rows.find((r) => r.status === "PENDING" && !r.lockedAt);
          return row ? [{ ...row }] : [];
        },
        updateMany: async (args: OutboxUpdateManyArgs) => {
          for (const id of args.where.id.in) {
            const row = rows.find((r) => r.id === id);
            if (row) Object.assign(row, args.data);
          }
          return { count: args.where.id.in.length };
        },
        update: async (args: OutboxUpdateArgs) => {
          const row = rows.find((r) => r.id === args.where.id)!;
          Object.assign(row, args.data);
          updatedArgs.push(args);
          return { ...row };
        },
      },
    };

    const poller = new OutboxPoller({
      prisma: db,
      serviceName: "auth-service",
      resolveTopic: () => KafkaTopics.DOMAIN_EVENTS,
      publish: async (p) => {
        published.push(p);
      },
      logger: noopLog,
      options: { maxRetries: 1, fallbackPollIntervalMs: 60_000 },
    });

    await poller.start();

    expect(published).toHaveLength(1);
    expect(published[0]!.topic).toBe(KafkaTopics.DOMAIN_EVENTS);
    expect(rows[0]!.status).toBe("COMPLETED");
    expect(rows[0]!.lockedBy).toBeNull();
    await poller.stop();
  });

  it("marks an event DEAD and routes it to the DLQ once publish fails past maxRetries", async () => {
    const rows: OutboxEventRow[] = [makeRow()];
    const published: PublishCall[] = [];

    const db: OutboxEventDb = {
      outboxEvent: {
        findMany: async () => {
          const row = rows.find((r) => r.status === "PENDING" && !r.lockedAt);
          return row ? [{ ...row }] : [];
        },
        updateMany: async (args: OutboxUpdateManyArgs) => {
          for (const id of args.where.id.in) {
            const row = rows.find((r) => r.id === id);
            if (row) Object.assign(row, args.data);
          }
          return { count: args.where.id.in.length };
        },
        update: async (args: OutboxUpdateArgs) => {
          const row = rows.find((r) => r.id === args.where.id)!;
          Object.assign(row, args.data);
          return { ...row };
        },
      },
    };

    const poller = new OutboxPoller({
      prisma: db,
      serviceName: "auth-service",
      resolveTopic: () => KafkaTopics.DOMAIN_EVENTS,
      publish: async (p) => {
        published.push(p);
        if (p.topic !== KafkaTopics.DLQ) {
          throw new Error("kafka down");
        }
      },
      logger: noopLog,
      options: { maxRetries: 1, fallbackPollIntervalMs: 60_000 },
    });

    await poller.start();

    expect(rows[0]!.status).toBe("DEAD");
    expect(rows[0]!.retryCount).toBe(1);
    // The publish error is wrapped into the typed OutboxPublishError path.
    expect(rows[0]!.lastError).toContain("kafka down");

    const dlqCall = published[1];
    expect(dlqCall).toBeDefined();
    expect(dlqCall!.topic).toBe(KafkaTopics.DLQ);
    const dlqValue = dlqCall!.value as Record<string, unknown>;
    expect(dlqValue.eventType).toBe(DLQEventTypes.DEAD_LETTER_EVENT);
    // `metadata` was removed from the envelope; the DLQ payload now carries the
    // triage context (failedAt) and the eventId-derived key.
    expect(dlqValue.payload).toHaveProperty("failedAt");
    await poller.stop();
  });

  it("retries (back to PENDING) before exhausting and only then goes DEAD", async () => {
    const rows: OutboxEventRow[] = [makeRow()];
    const published: PublishCall[] = [];

    const db: OutboxEventDb = {
      outboxEvent: {
        findMany: async () => {
          const row = rows.find((r) => r.status === "PENDING" && !r.lockedAt);
          return row ? [{ ...row }] : [];
        },
        updateMany: async (args: OutboxUpdateManyArgs) => {
          for (const id of args.where.id.in) {
            const row = rows.find((r) => r.id === id);
            if (row) Object.assign(row, args.data);
          }
          return { count: args.where.id.in.length };
        },
        update: async (args: OutboxUpdateArgs) => {
          const row = rows.find((r) => r.id === args.where.id)!;
          Object.assign(row, args.data);
          return { ...row };
        },
      },
    };

    const poller = new OutboxPoller({
      prisma: db,
      serviceName: "auth-service",
      resolveTopic: () => KafkaTopics.DOMAIN_EVENTS,
      publish: async (p) => {
        published.push(p);
        if (p.topic !== KafkaTopics.DLQ) {
          throw new Error("kafka down");
        }
      },
      logger: noopLog,
      options: { maxRetries: 2, fallbackPollIntervalMs: 60_000 },
    });

    await poller.start();

    // First drain: publish throws → row goes back to PENDING with retryCount 1
    expect(rows[0]!.status).toBe("PENDING");
    expect(rows[0]!.retryCount).toBe(1);

    // Second drain (simulate the next poll tick): stop, reset the row to
    // PENDING+unlocked, restart → publish throws again → DEAD.
    await poller.stop();
    rows[0]!.lockedAt = null;
    await poller.start();
    expect(rows[0]!.status).toBe("DEAD");
    expect(rows[0]!.retryCount).toBe(2);
    await poller.stop();
  });
});