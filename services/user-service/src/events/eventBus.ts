import { createEventBus, type EventBus } from "@nexus/kafka";
import { kafka, producer } from "../config/kafka.js";
import logger from "../utils/logger.js";

/**
 * user-service's single {@link EventBus} instance.
 *
 * WHY `createEventBus()` is called EXACTLY ONCE here (and nowhere else in this
 * service): the factory is not a singleton — every call builds a fresh closure
 * with its own `isProducerConnected` flag and its own `consumers` set. A second
 * call would therefore create a parallel EventBus that:
 *   - re-`connect()`s the shared producer because its flag starts `false`, and
 *   - is invisible to `disconnect()`, leaking consumer group members and
 *     producer sockets on shutdown (the graceful-shutdown path only knows
 *     about the instance it holds).
 *
 * So every other file MUST import this exported instance rather than calling
 * the factory itself. That keeps producer connection state and the consumer
 * registry authoritative in one place, which is what makes
 * `eventBus.disconnect()` a complete shutdown.
 *
 * `null` when Kafka credentials are unconfigured (see `config/kafka.ts`):
 * publishing is disabled rather than crashing local/dev runs without a broker.
 */
export const eventBus: EventBus | null =
  kafka && producer ? createEventBus(kafka, producer, logger) : null;
