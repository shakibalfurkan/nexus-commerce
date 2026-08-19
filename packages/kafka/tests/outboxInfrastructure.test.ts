import { afterEach, describe, expect, it, vi } from "vitest";
import { createOutboxInfrastructure } from "../src/outboxInfrastructure.js";
import { OutboxPoller } from "../src/outboxPoller.js";
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

const resolveTopic = (eventType: string) => `topic-for-${eventType}`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createOutboxInfrastructure", () => {
  it("delegates start()/stop() to the poller (no listener)", async () => {
    const pollerStart = vi
      .spyOn(OutboxPoller.prototype, "start")
      .mockResolvedValue();
    const pollerStop = vi
      .spyOn(OutboxPoller.prototype, "stop")
      .mockResolvedValue();

    const infra = createOutboxInfrastructure({
      prisma: fakePrisma,
      serviceName: "auth-service",
      eventBus: null,
      resolveTopic,
      logger: noopLog,
    });

    await infra.start();
    await infra.stop();

    expect(pollerStart).toHaveBeenCalledOnce();
    expect(pollerStop).toHaveBeenCalledOnce();
  });
});
