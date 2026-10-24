import type { PrismaClient } from "../generated/prisma/client.js";

/**
 * Transaction client shape handed to repository functions that must join an
 * existing `prisma.$transaction(...)` — e.g. the outbox write, which has to be
 * atomic with the business write (see `@nexus/kafka`'s `writeOutboxEvent`).
 *
 * Mirrors user-service's `src/types/database.types.ts` so both services share
 * the same repository signature convention.
 */
export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
