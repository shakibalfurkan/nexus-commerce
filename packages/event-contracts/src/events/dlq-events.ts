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
    originalEventId: z.string(),
    originalEventType: z.string(),
    error: z.string(),
    failedAt: z.string(),
  }),
});

export type DeadLetterEvent = z.infer<typeof DeadLetterEventSchema>;
