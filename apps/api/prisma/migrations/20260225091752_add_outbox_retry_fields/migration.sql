-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "OutboxEvent_published_lastAttemptAt_idx" ON "OutboxEvent"("published", "lastAttemptAt");
