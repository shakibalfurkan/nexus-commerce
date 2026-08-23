import { describe, expect, it, vi } from "vitest";
import { publishDeadLetterEvent } from "../src/deadLetter.js";
import { KafkaTopics, DLQEventTypes } from "@nexus/event-contracts";
import type { Logger } from "@nexus/logger";

const noopLog: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  http: vi.fn(),
};

describe("publishDeadLetterEvent", () => {
  it("publishes to the DLQ topic with the passed service name as source", async () => {
    const published: Array<{
      topic: string;
      key: string;
      value: Record<string, unknown>;
    }> = [];
    const publish = vi.fn(async (p: { topic: string; key: string; value: unknown }) => {
      published.push(p);
    });

    await publishDeadLetterEvent({
      serviceName: "auth-service",
      eventId: "evt-123",
      eventType: "user.registered",
      errorMessage: "boom",
      publish,
      logger: noopLog,
    });

    expect(published).toHaveLength(1);
    expect(published[0]!.topic).toBe(KafkaTopics.DLQ);
    expect(published[0]!.key).toBe("dlq-evt-123");
    const value = published[0]!.value as Record<string, unknown>;
    // The headline bug was a hardcoded service name — the published key derives
    // from the passed eventId, never a hardcoded value (was previously
    // hardcoding the source in metadata).
    expect(value.payload).toHaveProperty("failedAt");
    expect(value.eventType).toBe(DLQEventTypes.DEAD_LETTER_EVENT);
    const payload = value.payload as Record<string, unknown>;
    expect(payload.sourceService).toBe("auth-service");
    expect(payload.originalEventId).toBe("evt-123");
    expect(payload.originalEventType).toBe("user.registered");
    expect(payload.failureStage).toBe("publish");
    expect(payload.error).toBe("boom");
  });

  it("carries consume-stage context when provided", async () => {
    const published: Array<{
      topic: string;
      key: string;
      value: Record<string, unknown>;
    }> = [];
    await publishDeadLetterEvent({
      serviceName: "notification-service",
      eventId: "domain-events:0:42",
      eventType: null,
      failureStage: "consume",
      errorMessage: "schema mismatch",
      rawPayload: "{not json",
      traceparent: "00-trace-span-01",
      correlationId: "corr-1",
      publish: async (p) => {
        published.push(p);
      },
      logger: noopLog,
    });

    expect(published).toHaveLength(1);
    const payload = published[0]!.value.payload as Record<string, unknown>;
    expect(payload.sourceService).toBe("notification-service");
    expect(payload.failureStage).toBe("consume");
    expect(payload.rawPayload).toBe("{not json");
    expect(published[0]!.value.traceparent).toBe("00-trace-span-01");
    expect(published[0]!.value.correlationId).toBe("corr-1");
  });

  it("does not throw when the Kafka publish fails (best-effort, DB is truth)", async () => {
    const publish = vi.fn(async () => {
      throw new Error("kafka down");
    });

    await expect(
      publishDeadLetterEvent({
        serviceName: "user-service",
        eventId: "evt-2",
        eventType: "x",
        errorMessage: "boom",
        publish,
        logger: noopLog,
      }),
    ).resolves.toBeUndefined();
  });
});
