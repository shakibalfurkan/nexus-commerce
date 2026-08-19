/**
 * auth-service outbox writer — delegates to the shared implementation in
 * @nexus/kafka. The shared `writeOutboxEvent`/`emitDomainEvent` REQUIRE `tx`
 * (no global-client fallback), fixing the prior atomicity bug. Signature order
 * is `(tx, event, traceparent)`.
 */
export {
  writeOutboxEvent,
  emitDomainEvent,
  type PrismaTransaction,
  type OutboxEventInput,
} from "@nexus/kafka";
