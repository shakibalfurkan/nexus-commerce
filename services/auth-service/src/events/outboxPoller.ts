import { createOutboxInfrastructure } from "@nexus/kafka";
import { prisma } from "../lib/prisma.js";
import { eventBus } from "./eventBus.js";
import { resolveTopic } from "./outboxWriter.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";

// All outbox wiring (EventBus + OutboxPoller + OutboxListener) now lives in the
// shared @nexus/kafka package. This file is a thin per-service adapter: it
// supplies the Prisma client, its single EventBus instance, the canonical
// service name, and the event-type → topic resolver. start/stop are
// re-exported with the same names so server.ts is unchanged.
const outbox = createOutboxInfrastructure({
  prisma,
  serviceName: config.serviceName,
  eventBus,
  resolveTopic,
  logger,
});

export async function startOutboxPoller(): Promise<void> {
  await outbox.start();
}

export async function stopOutboxPoller(): Promise<void> {
  await outbox.stop();
}
