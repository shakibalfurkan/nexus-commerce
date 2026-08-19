import { describe, expect, it, vi } from "vitest";
import { writeOutboxEvent, emitDomainEvent } from "../src/outboxWriter.js";

type CreateArgs = { data: Record<string, unknown> };

function fakeTx() {
  const create = vi.fn(async (args: CreateArgs) => ({ id: args.data.id as string }));
  return {
    tx: { outboxEvent: { create } },
    create,
  };
}

const EVENT = {
  eventType: "user.registered",
  aggregateId: "00000000-0000-4000-8000-000000000000",
  payload: { userId: "u1", email: "a@b.com" },
};

describe("writeOutboxEvent", () => {
  it("persists exactly one outbox row inside the given tx", async () => {
    const { tx, create } = fakeTx();
    await writeOutboxEvent(tx, EVENT);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("persists aggregateId, eventType and the echoed payload", async () => {
    const { tx, create } = fakeTx();
    await writeOutboxEvent(tx, EVENT);
    const data = create.mock.calls[0]![0].data;
    expect(data.aggregateId).toBe(EVENT.aggregateId);
    expect(data.eventType).toBe(EVENT.eventType);
    expect(data.payload).toEqual(EVENT.payload);
  });

  it("generates a uuid id and returns it", async () => {
    const { tx, create } = fakeTx();
    const returned = await writeOutboxEvent(tx, EVENT);
    const data = create.mock.calls[0]![0].data;
    expect(data.id).toBe(returned);
    expect(typeof returned).toBe("string");
    expect(returned).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("writes PENDING status with zeroed retry bookkeeping", async () => {
    const { tx, create } = fakeTx();
    await writeOutboxEvent(tx, EVENT);
    const data = create.mock.calls[0]![0].data;
    expect(data.status).toBe("PENDING");
    expect(data.retryCount).toBe(0);
    expect(data.maxRetries).toBe(5);
  });

  it("stores the passed traceparent, or null when omitted", async () => {
    const { tx: tx1, create: c1 } = fakeTx();
    await writeOutboxEvent(tx1, EVENT, "trace-abc");
    expect(c1.mock.calls[0]![0].data.traceparent).toBe("trace-abc");

    const { tx: tx2, create: c2 } = fakeTx();
    await writeOutboxEvent(tx2, EVENT);
    expect(c2.mock.calls[0]![0].data.traceparent).toBeNull();
  });

  it("requires tx — no silent global-client fallback", async () => {
    // tx is typed unknown; passing null means the cast `tx as OutboxEventDelegate`
    // yields a null delegate and `.outboxEvent.create` throws. This proves the
    // writer never substitutes a global Prisma client.
    await expect(writeOutboxEvent(null as unknown, EVENT)).rejects.toThrow();
    await expect(writeOutboxEvent(undefined as unknown, EVENT)).rejects.toThrow();
  });
});

describe("emitDomainEvent", () => {
  it("is an alias for writeOutboxEvent with identical behavior", async () => {
    const { tx, create } = fakeTx();
    const returned = await emitDomainEvent(tx, EVENT, "trace-xyz");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0].data.traceparent).toBe("trace-xyz");
    expect(returned).toMatch(/^[0-9a-f-]{36}$/);
  });
});
