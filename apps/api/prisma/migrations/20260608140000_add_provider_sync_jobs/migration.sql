-- CreateEnum
CREATE TYPE "ProviderSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProviderSyncJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" "FinancialDataProvider" NOT NULL,
    "webhookEventId" TEXT,
    "syncType" TEXT NOT NULL,
    "syncMode" TEXT,
    "trigger" "SyncTrigger" NOT NULL,
    "reason" TEXT,
    "status" "ProviderSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderSyncJob_status_scheduledAt_idx" ON "ProviderSyncJob"("status", "scheduledAt");
CREATE INDEX "ProviderSyncJob_connectionId_idx" ON "ProviderSyncJob"("connectionId");
CREATE INDEX "ProviderSyncJob_userId_idx" ON "ProviderSyncJob"("userId");
CREATE INDEX "ProviderSyncJob_webhookEventId_idx" ON "ProviderSyncJob"("webhookEventId");

-- AddForeignKey
ALTER TABLE "ProviderSyncJob" ADD CONSTRAINT "ProviderSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "FinancialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncJob" ADD CONSTRAINT "ProviderSyncJob_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "ProviderWebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
