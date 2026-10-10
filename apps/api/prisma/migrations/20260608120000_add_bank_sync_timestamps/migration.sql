-- AlterTable
ALTER TABLE "FinancialConnection" ADD COLUMN "lastTransactionSyncAt" TIMESTAMP(3),
ADD COLUMN "lastBalanceSyncAt" TIMESTAMP(3),
ADD COLUMN "lastRealtimeBalanceSyncAt" TIMESTAMP(3),
ADD COLUMN "lastHoldingsSyncAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN "lastTransactionSyncAt" TIMESTAMP(3),
ADD COLUMN "lastBalanceSyncAt" TIMESTAMP(3),
ADD COLUMN "lastRealtimeBalanceSyncAt" TIMESTAMP(3),
ADD COLUMN "lastHoldingsSyncAt" TIMESTAMP(3),
ADD COLUMN "lastProviderWebhookAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProviderSyncAttempt" ADD COLUMN "userId" TEXT,
ADD COLUMN "syncType" TEXT,
ADD COLUMN "syncMode" TEXT,
ADD COLUMN "reason" TEXT,
ADD COLUMN "endpointsCalled" JSONB,
ADD COLUMN "estimatedCostCategory" TEXT;

-- CreateIndex
CREATE INDEX "ProviderSyncAttempt_userId_trigger_createdAt_idx" ON "ProviderSyncAttempt"("userId", "trigger", "createdAt");

-- Backfill PlaidItem transaction sync timestamps from legacy field
UPDATE "PlaidItem"
SET "lastTransactionSyncAt" = "lastSuccessfulSyncAt"
WHERE "lastSuccessfulSyncAt" IS NOT NULL
  AND "lastTransactionSyncAt" IS NULL;

-- Backfill PlaidItem balance sync timestamps from account rollup
UPDATE "PlaidItem" AS pi
SET "lastBalanceSyncAt" = sub.max_balance_sync
FROM (
    SELECT "plaidItemId", MAX("lastBalanceSyncAt") AS max_balance_sync
    FROM "PlaidAccount"
    WHERE "lastBalanceSyncAt" IS NOT NULL
    GROUP BY "plaidItemId"
) AS sub
WHERE pi.id = sub."plaidItemId"
  AND pi."lastBalanceSyncAt" IS NULL;

-- Backfill FinancialConnection from linked Plaid items
UPDATE "FinancialConnection" AS fc
SET
    "lastTransactionSyncAt" = pi."lastTransactionSyncAt",
    "lastBalanceSyncAt" = pi."lastBalanceSyncAt"
FROM "PlaidItem" AS pi
WHERE fc.provider = 'PLAID'
  AND fc."providerConnectionId" = pi."plaidItemId";
