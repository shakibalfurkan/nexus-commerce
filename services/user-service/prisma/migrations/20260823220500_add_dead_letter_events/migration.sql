-- CreateTable
CREATE TABLE "dead_letter_events" (
    "id" TEXT NOT NULL,
    "sourceService" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "failureStage" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "payload" JSONB,
    "traceparent" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letter_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dead_letter_events_sourceService_createdAt_idx" ON "dead_letter_events"("sourceService", "createdAt");

-- CreateIndex
CREATE INDEX "dead_letter_events_eventType_idx" ON "dead_letter_events"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "dead_letter_events_sourceService_eventId_key" ON "dead_letter_events"("sourceService", "eventId");

