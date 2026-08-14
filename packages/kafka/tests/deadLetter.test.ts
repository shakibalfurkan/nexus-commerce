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
    const published: Array<{ topic: string; key: string; value: any }> = [];
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
    // The headline bug was a hardcoded service name — the value must use the
    // passed param, and never hardcode "user-service-outbox-poller".
    expect((value.metadata as Record<string, unknown>).source).toBe("auth-service");
    expect(value.eventType).toBe(DLQEventTypes.DEAD_LETTER_EVENT);
    expect((value.payload as Record<string, unknown>).originalEventId).toBe("evt-123");
    expect((value.payload as Record<string, unknown>).originalEventType).toBe("user.registered");
    expect((value.payload as Record<string, unknown>).error).toBe("boom");
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
