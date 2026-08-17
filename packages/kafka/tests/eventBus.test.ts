import { describe, expect, it, vi, type Mock } from "vitest";
import { createEventBus, parseJsonMessage } from "../src/eventBus.js";
import type { Logger } from "@nexus/logger";

const noopLog: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  http: vi.fn(),
};

interface FakeMessage {
  value: Buffer | null;
  offset: string;
  key: Buffer | null;
  headers: Record<string, Buffer | string>;
}

interface FakeProducerSpies {
  connect: Mock;
  send: Mock;
  disconnect: Mock;
}

interface FakeConsumerSpies {
  disconnect: Mock;
}

/**
 * Builds a fake kafkajs `Kafka` + `Producer` pair whose `consumer.run`
 * immediately dispatches `eachMessage` with `message`, so a `subscribe`
 * handler can be exercised synchronously inside a test.
 */
function makeFakes(message: FakeMessage): {
  kafka: never;
  producer: never;
  producerSpies: FakeProducerSpies;
  consumerSpies: FakeConsumerSpies;
} {
  const consumer = {
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    run: vi
      .fn()
      .mockImplementation(
        async ({
          eachMessage,
        }: {
          eachMessage: (payload: unknown) => Promise<void>;
        }) => {
          await eachMessage({ topic: "domain-events", partition: 0, message });
        },
      ),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
  const kafka = {
    consumer: vi.fn().mockReturnValue(consumer),
  } as never;
  const producerFns = {
    connect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
  const producer = producerFns as never;
  return {
    kafka,
    producer,
    producerSpies: producerFns,
    consumerSpies: { disconnect: consumer.disconnect },
  };
}

describe("createEventBus.subscribe", () => {
  it("hands the handler the RAW value + decoded headers + context (no forced JSON.parse)", async () => {
    const message: FakeMessage = {
      value: Buffer.from("not-json"),
      offset: "42",
      key: Buffer.from("k-1"),
      headers: {
        traceparent: Buffer.from("tp-1"),
        correlationid: Buffer.from("corr-1"),
        "correlation-id": "corr-alt",
      },
    };
    const { kafka, producer } = makeFakes(message);
    const bus = createEventBus(kafka, producer, noopLog);

    let capturedRaw: string | null | undefined;
    let capturedTopic: string | undefined;
    let capturedPartition: number | undefined;
    let capturedOffset: string | undefined;
    let capturedKey: string | null | undefined;
    let capturedHeaders: Record<string, string | undefined> | undefined;
    let capturedTraceparent: string | undefined;

    await bus.subscribe({
      topic: "domain-events",
      groupId: "g1",
      handler: async (rawValue, context) => {
        capturedRaw = rawValue;
        capturedTopic = context.topic;
        capturedPartition = context.partition;
        capturedOffset = context.offset;
        capturedKey = context.key;
        capturedHeaders = context.headers;
        capturedTraceparent = context.traceparent;
      },
    });

    expect(capturedRaw).toBe("not-json"); // raw, NOT JSON.parsed
    expect(capturedTopic).toBe("domain-events");
    expect(capturedPartition).toBe(0);
    expect(capturedOffset).toBe("42");
    expect(capturedKey).toBe("k-1");
    expect(capturedHeaders?.traceparent).toBe("tp-1");
    expect(capturedHeaders?.correlationid).toBe("corr-1");
    expect(capturedHeaders?.["correlation-id"]).toBe("corr-alt");
    expect(capturedTraceparent).toBe("tp-1");
  });

  it("propagates handler errors so Kafka redelivers (at-least-once)", async () => {
    const message: FakeMessage = {
      value: Buffer.from("{}"),
      offset: "1",
      key: null,
      headers: {},
    };
    const { kafka, producer } = makeFakes(message);
    const bus = createEventBus(kafka, producer, noopLog);

    await expect(
      bus.subscribe({
        topic: "domain-events",
        groupId: "g1",
        handler: async () => {
          throw new Error("boom");
        },
      }),
    ).rejects.toThrow("boom");
  });

  it("treats a null message value as null (not coerced to {})", async () => {
    const message: FakeMessage = {
      value: null,
      offset: "7",
      key: null,
      headers: {},
    };
    const { kafka, producer } = makeFakes(message);
    const bus = createEventBus(kafka, producer, noopLog);

    let capturedRaw: string | null | undefined = "unset";
    await bus.subscribe({
      topic: "domain-events",
      groupId: "g1",
      handler: async (rawValue) => {
        capturedRaw = rawValue;
      },
    });

    expect(capturedRaw).toBeNull();
  });
});

describe("createEventBus lifecycle", () => {
  const emptyMessage: FakeMessage = {
    value: Buffer.from("{}"),
    offset: "0",
    key: null,
    headers: {},
  };

  it("connect() is idempotent and does not reconnect an already-open producer", async () => {
    const { kafka, producer, producerSpies } = makeFakes(emptyMessage);
    const bus = createEventBus(kafka, producer, noopLog);

    await bus.connect();
    await bus.connect();

    expect(producerSpies.connect).toHaveBeenCalledTimes(1);
  });

  it("publish() connects lazily when connect() was never called", async () => {
    const { kafka, producer, producerSpies } = makeFakes(emptyMessage);
    const bus = createEventBus(kafka, producer, noopLog);

    await bus.publish({ topic: "t", key: "k", value: { a: 1 } });

    expect(producerSpies.connect).toHaveBeenCalledTimes(1);
    // value is serialized by the bus — callers pass plain objects, never a
    // pre-stringified payload (which would double-encode).
    expect(producerSpies.send).toHaveBeenCalledWith({
      topic: "t",
      messages: [{ key: "k", value: '{"a":1}', headers: {} }],
    });
  });

  it("disconnect() tears down both subscribed consumers and the producer", async () => {
    const { kafka, producer, producerSpies, consumerSpies } =
      makeFakes(emptyMessage);
    const bus = createEventBus(kafka, producer, noopLog);

    await bus.connect();
    await bus.subscribe({
      topic: "domain-events",
      groupId: "g1",
      handler: async () => {},
    });

    await bus.disconnect();

    expect(consumerSpies.disconnect).toHaveBeenCalled();
    expect(producerSpies.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("parseJsonMessage", () => {
  it("parses raw JSON and treats null as an empty object", () => {
    expect(parseJsonMessage(null)).toEqual({});
    expect(parseJsonMessage('{"a":1}')).toEqual({ a: 1 });
  });
});
