import type { Logger } from "@nexus/logger";
import { OutboxPoller } from "./outboxPoller.js";
import type { EventBus } from "./eventBus.js";
import type {
  OutboxEventDb,
  OutboxPublishParams,
  OutboxPollerOptions,
  TopicResolver,
} from "./types.js";

/**
 * Everything a service needs to wire the shared outbox to its Kafka producer
 * in one place. The outbox is drained by a single interval poller — there is
 * no LISTEN/NOTIFY listener (CockroachDB, used by several services, does not
 * support it, so polling is the uniform delivery mechanism across providers).
 */
export interface OutboxInfrastructureDeps {
  prisma: OutboxEventDb;
  eventBus: EventBus | null;
  serviceName: string;
  resolveTopic: TopicResolver;
  logger: Logger;
  options?: Partial<OutboxPollerOptions>;
}

export interface OutboxInfrastructure {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createOutboxInfrastructure(
  deps: OutboxInfrastructureDeps,
): OutboxInfrastructure {
  const {
    prisma,
    serviceName,
    eventBus,
    resolveTopic,
    logger,
    options,
  } = deps;

  // Publish through the service's single EventBus instance. EventBus.publish
  // rethrows on failure so the poller's retry/DLQ path triggers (fixes the
  // silent false-completion bug). When Kafka is unconfigured, publish is a
  // logged no-op so the poller never silently drops events.
  const publish = eventBus
    ? (params: OutboxPublishParams) => eventBus.publish(params)
    : async () => {
        logger.warn("[OutboxPoller] EventBus not available — cannot publish");
      };

  const poller = new OutboxPoller({
    prisma,
    serviceName,
    resolveTopic,
    publish,
    logger,
    // exactOptionalPropertyTypes: only attach `options` when actually provided,
    // so an `undefined` value is never explicitly assigned to an optional prop.
    ...(options ? { options } : {}),
  });

  return {
    async start() {
      await poller.start();
      logger.info("[Outbox] Poller started");
    },
    async stop() {
      await poller.stop();
      logger.info("[Outbox] Poller stopped");
    },
  };
}
