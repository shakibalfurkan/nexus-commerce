import { OutboxPoller, resolveTopic } from "@nexus/kafka";
import { prisma } from "../lib/prisma.js";
import { publishOutboxEvent } from "./eventBus.js";
import logger from "../utils/logger.js";

// Thin per-service adapter: supplies the Prisma client, its canonical service
// name, the EventBus-backed publisher, and the event-type → topic resolver to
// the shared OutboxPoller. start/stop are re-exported with the same names so
// server.ts is unchanged.
const outbox = new OutboxPoller({
  prisma,
  serviceName: "user-service",
  resolveTopic,
  publish: publishOutboxEvent,
  logger,
});

export async function startOutboxPoller(): Promise<void> {
  await outbox.start();
}

export async function stopOutboxPoller(): Promise<void> {
  await outbox.stop();
}
