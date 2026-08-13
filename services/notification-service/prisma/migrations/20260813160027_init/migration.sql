-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DLQ');

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "payloadSnapshot" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "traceparent" TEXT,
    "correlationId" TEXT,
    "causationId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_queue" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "failureReason" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "traceparent" TEXT,
    "correlationId" TEXT,
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_eventId_key" ON "notification_logs"("eventId");

-- CreateIndex
CREATE INDEX "notification_logs_status_createdAt_idx" ON "notification_logs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_status_nextRetryAt_idx" ON "notification_logs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "notification_logs_recipient_createdAt_idx" ON "notification_logs"("recipient", "createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_eventType_idx" ON "notification_logs"("eventType");

-- CreateIndex
CREATE INDEX "dead_letter_queue_eventType_idx" ON "dead_letter_queue"("eventType");

-- CreateIndex
CREATE INDEX "dead_letter_queue_enqueuedAt_idx" ON "dead_letter_queue"("enqueuedAt");

-- CreateIndex
CREATE INDEX "dead_letter_queue_recipient_idx" ON "dead_letter_queue"("recipient");
