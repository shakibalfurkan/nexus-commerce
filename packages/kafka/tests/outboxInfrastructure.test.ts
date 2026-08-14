import { afterEach, describe, expect, it, vi } from "vitest";
import { createOutboxInfrastructure } from "../src/outboxInfrastructure.js";
import { OutboxPoller } from "../src/outboxPoller.js";
import { OutboxListener } from "../src/outboxListener.js";
import type { Logger } from "@nexus/logger";
import type { OutboxEventDb } from "../src/types.js";

const noopLog: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  http: vi.fn(),
};

const fakePrisma = {} as unknown as OutboxEventDb;
const fakeKafka = {} as never;
const fakeProducer = {} as never;

const resolveTopic = (eventType: string) => `topic-for-${eventType}`;

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DATABASE_URL;
});

describe("createOutboxInfrastructure", () => {
  it("delegates start()/stop() to the poller and listener", async () => {
    const pollerStart = vi
      .spyOn(OutboxPoller.prototype, "start")
      .mockResolvedValue();
    const pollerStop = vi
      .spyOn(OutboxPoller.prototype, "stop")
      .mockResolvedValue();
    const listenerStart = vi
      .spyOn(OutboxListener.prototype, "start")
      .mockResolvedValue();
    const listenerStop = vi
      .spyOn(OutboxListener.prototype, "stop")
      .mockResolvedValue();

    process.env.DATABASE_URL = "postgres://localhost:5432/nexus";

    const infra = createOutboxInfrastructure({
      prisma: fakePrisma,
      serviceName: "auth-service",
      kafka: fakeKafka,
      producer: fakeProducer,
      resolveTopic,
      logger: noopLog,
    });

    await infra.start();
    await infra.stop();

    expect(listenerStart).toHaveBeenCalledOnce();
    expect(pollerStart).toHaveBeenCalledOnce();
    expect(listenerStop).toHaveBeenCalledOnce();
    expect(pollerStop).toHaveBeenCalledOnce();
  });

  it("throws when DATABASE_URL is missing (listener cannot connect)", () => {
    expect(() =>
      createOutboxInfrastructure({
        prisma: fakePrisma,
        serviceName: "auth-service",
        kafka: fakeKafka,
        producer: fakeProducer,
        resolveTopic,
        logger: noopLog,
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
