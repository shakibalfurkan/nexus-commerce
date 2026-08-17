import { createEventBus, type EventBus } from "@nexus/kafka";
import { kafka, producer } from "../config/kafka.js";
import logger from "../utils/logger.js";

/**
 * notification-service's single {@link EventBus} instance.
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
 * This matters most in this service, which both SUBSCRIBES (domain events) and
 * PUBLISHES (DLQ routing). Both sides must share one instance so the single
 * `eventBus.disconnect()` in `server.ts` tears down the consumer AND the
 * producer — the reason the old hand-rolled `kafka-consumer.ts` needed two
 * separate disconnect helpers.
 *
 * So every other file MUST import this exported instance rather than calling
 * the factory itself.
 *
 * `null` when Kafka credentials are unconfigured (see `config/kafka.ts`):
 * the consumer does not start and DLQ publishing degrades to DB-only, rather
 * than crashing local/dev runs without a broker.
 */
export const eventBus: EventBus | null =
  kafka && producer ? createEventBus(kafka, producer, logger) : null;
