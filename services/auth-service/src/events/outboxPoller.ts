import { OutboxPoller } from "@nexus/kafka";
import { prisma } from "../lib/prisma.js";
import { publishOutboxEvent } from "./eventBus.js";
import { resolveTopic } from "./outboxWriter.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";

// Thin per-service adapter: supplies the Prisma client, its canonical service
// name, the EventBus-backed publisher, and the event-type → topic resolver to
// the shared OutboxPoller. start/stop are re-exported with the same names so
// server.ts is unchanged.
const outbox = new OutboxPoller({
  prisma,
  serviceName: config.serviceName,
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
