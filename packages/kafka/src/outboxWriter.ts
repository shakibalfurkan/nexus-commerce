import { v4 as uuidv4 } from "uuid";

/**
 * Shared outbox writer — one implementation for every service.
 *
 * `tx` is REQUIRED (never optional, never falling back to a global client).
 * The outbox insert MUST happen inside the same transaction as the business
 * write; a silent fallback to a global Prisma client broke that atomicity
 * guarantee (the historical auth-service bug). Callers MUST pass the `tx` from
 * their enclosing `prisma.$transaction(async (tx) => { ... })`.
 *
 * `tx` is typed `unknown` on purpose: `@nexus/kafka` is Prisma-agnostic and its
 * generated client is not available here (no `prisma generate` step). Every
 * service's transaction client satisfies the minimal capability we use
 * (`outboxEvent.create` with id/aggregateId/eventType/payload/traceparent/
 * status/retryCount/maxRetries), so we cast to that shape at the single
 * boundary below. The outbox row stores only `payload`, and the poller
 * publishes `payload` to Kafka. `metadata` was removed from the canonical
 * envelope — it was never persisted or published, so callers no longer pass it.
 */
export type PrismaTransaction = unknown;

/** Minimal `outboxEvent.create` capability the writer relies on. */
interface OutboxEventDelegate {
  outboxEvent: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

export interface OutboxEventInput {
  eventType: string;
  aggregateId: string;
  payload: unknown;
}

export async function writeOutboxEvent(
  tx: PrismaTransaction,
  event: OutboxEventInput,
  traceparent?: string,
): Promise<string> {
  const id = uuidv4();
  const delegate = tx as OutboxEventDelegate;

  await delegate.outboxEvent.create({
    data: {
      id,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      traceparent: traceparent ?? null,
      status: "PENDING",
      retryCount: 0,
      maxRetries: 5,
    },
  });

  return id;
}

export async function emitDomainEvent(
  tx: PrismaTransaction,
  event: OutboxEventInput,
  traceparent?: string,
): Promise<string> {
  return writeOutboxEvent(tx, event, traceparent);
}
