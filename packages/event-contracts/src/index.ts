/**
 * @nexus/event-contracts — shared domain-event contracts.
 *
 * Barrel ONLY: re-exports the canonical envelope, Kafka topics, and per-domain
 * event schemas. No logic lives here.
 *
 * Canonical envelope (the ONE shape every service uses):
 *   { eventType, aggregateId, payload }
 */

export * from "./envelope.js";
export * from "./topics.js";
export * from "./events/authEvents.js";
export * from "./events/userEvents.js";
export * from "./events/dlqEvents.js";
