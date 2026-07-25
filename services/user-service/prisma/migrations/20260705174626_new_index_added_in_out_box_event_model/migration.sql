-- CreateIndex
CREATE INDEX "idx_outbox_polling" ON "outbox_events"("status", "lockedAt", "createdAt");
