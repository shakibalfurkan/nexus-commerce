import { z } from "zod";

/**
 * Canonical Nexus domain-event envelope — the ONE shape every producer builds
 * and every consumer validates.
 *
 *   { eventType, aggregateId, payload, metadata: { emittedAt, source, version } }
 *
 * This replaces two conflicting historical shapes:
 *   - the per-service `eventTypes.ts` nested `metadata` shape (auth/user —
 *     already wire-compatible, kept),
 *   - the flat `EventEnvelopeSchema` in old `event-contracts` (eventId /
 *     producer / occurredAt / eventVersion / correlationId / causationId) which
 *     was DEAD CODE (never imported anywhere) and is now removed.
 *
 * NOTE on `traceparent`: it travels in Kafka MESSAGE HEADERS, never the JSON
 * body (see @nexus/kafka's OutboxPublishParams + EventBus.publish). The body
 * envelope therefore has no `traceparent` field; the outbox writer keeps it as
 * a separate parameter + DB column.
 */

export const EventMetadataSchema = z.object({
  emittedAt: z.iso.datetime(),
  source: z.string(),
  version: z.number().int().positive(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

/**
 * Generic envelope carrying an arbitrary payload. Concrete events narrow
 * `payload` + `eventType` via the per-event schemas in ./events/*.
 *
 * `aggregateId` is `z.uuid()`: every real producer (auth uuidv5(email),
 * user-service ids, notification consumer) emits a uuid, and a strict boundary
 * is the production-safe choice.
 */
export const DomainEventEnvelopeSchema = z.object({
  eventType: z.string(),
  aggregateId: z.uuid(),
  payload: z.unknown(),
  metadata: EventMetadataSchema,
});

export type DomainEventEnvelope = z.infer<typeof DomainEventEnvelopeSchema>;

/** Builds the `metadata` block consistently across services. */
export function createEventMetadata(source: string): EventMetadata {
  return {
    emittedAt: new Date().toISOString(),
    source,
    version: 1,
  };
}
