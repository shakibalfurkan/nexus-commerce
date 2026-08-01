# Milestone 1 — Data Models & Event Payload Schema

- [x] 1. Edit `services/notification-service/prisma/schema.prisma` — add
     `notificationType`, `payloadSnapshot`, `NotificationType` enum
- [x] 2. Create
     `services/notification-service/src/events/domain-event.schemas.ts` —
     wire-accurate Zod v4 boundary schemas + event registry map
- [x] 3. Create `services/notification-service/src/types/kafka-message.types.ts`
     — incoming message container + trace-aware parser
- [x] 4. Edit `services/notification-service/package.json` — add `zod` (Kafka
     boundary validation)
- [x] 5. Create `services/notification-service/.env.example` — cloud env
     placeholders
- [x] 6. `pnpm install` → `prisma format` → `prisma validate` →
     `prisma generate` → `tsc --noEmit`
- [x] 7. Git commit:
     `feat(notification): add event schemas and notification log data model`
