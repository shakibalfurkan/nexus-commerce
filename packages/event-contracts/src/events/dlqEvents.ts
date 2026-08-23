import { z } from "zod";


/**
 * Dead-letter event. Published by @nexus/kafka's `publishDeadLetterEvent`
 * (exhausted outbox retries) to KafkaTopics.DLQ.
 */

export const DLQEventTypes = {
  DEAD_LETTER_EVENT: "dead_letter.event",
} as const;

export type TDLQEventType =
  (typeof DLQEventTypes)[keyof typeof DLQEventTypes];

export const DeadLetterEventSchema = z.object({
  eventType: z.literal(DLQEventTypes.DEAD_LETTER_EVENT),
  aggregateId: z.string(),
  payload: z.object({
    /** Service that produced the dead-letter event. */
    sourceService: z.string(),
    originalEventId: z.string(),
    originalEventType: z.string().nullable(),
    /** Where the failure happened: outbox publish vs consumer processing. */
    failureStage: z.enum(["publish", "consume"]),
    error: z.string(),
    /** Raw message preserved for manual inspection / re-drive (optional). */
    rawPayload: z.string().optional(),
    failedAt: z.string(),
  }),
  traceparent: z.string().optional(),
  correlationId: z.string().optional(),
});

export type DeadLetterEvent = z.infer<typeof DeadLetterEventSchema>;
