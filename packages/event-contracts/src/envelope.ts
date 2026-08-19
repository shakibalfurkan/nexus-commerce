import { z } from "zod";

/**
 * Canonical Nexus domain-event envelope — the ONE shape every producer builds
 * and every consumer validates.
 *
 *   { eventType, aggregateId, payload }
 *
 * NOTE on `traceparent`: it travels in Kafka MESSAGE HEADERS, never the JSON
 * body (see @nexus/kafka's OutboxPublishParams + EventBus.publish). The body
 * envelope therefore has no `traceparent` field; the outbox writer keeps it as
 * a separate parameter + DB column.
 *
 * `metadata` was intentionally removed: it was never persisted or published by
 * writeOutboxEvent/outboxPoller (only `payload` is), so it was dead weight.
 * emittedAt is redundant with the Kafka broker timestamp; source is already
 * carried explicitly by the DLQ publish path (serviceName); version is
 * premature until multiple envelope versions coexist in production.
 */

export const DomainEventEnvelopeSchema = z.object({
  eventType: z.string(),
  aggregateId: z.uuid(),
  payload: z.unknown(),
});

export type DomainEventEnvelope = z.infer<typeof DomainEventEnvelopeSchema>;
