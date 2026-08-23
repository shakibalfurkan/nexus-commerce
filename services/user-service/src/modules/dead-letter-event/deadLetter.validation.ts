import { z } from "zod";

export const DeadLetterValidation = {
  listQuery: z.object({
    sourceService: z.string().trim().min(1).optional(),
    eventType: z.string().trim().min(1).optional(),
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
} as const;
