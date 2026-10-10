-- Migration: plaid_transaction_fields
-- Adds new fields required for Plaid transactions/sync integration.
-- Non-destructive: no table recreation, no truncation, no primary key rewrites.

-- AlterTable: add all new nullable columns
ALTER TABLE "Transaction"
ADD COLUMN "postedDate"             TIMESTAMP(3),
ADD COLUMN "authorizedDate"         TIMESTAMP(3),
ADD COLUMN "isoCurrencyCode"        TEXT,
ADD COLUMN "unofficialCurrencyCode" TEXT,
ADD COLUMN "originalDescription"    TEXT,
ADD COLUMN "merchantName"           TEXT,
ADD COLUMN "paymentChannel"         TEXT,
ADD COLUMN "pendingTransactionId"   TEXT,
ADD COLUMN "removedAt"              TIMESTAMP(3),
ADD COLUMN "raw"                    JSONB;

-- Convert amount from float to Decimal(14,2) in-place (preserves all rows).
-- ROUND(..., 2) ensures no truncation silently drops sub-cent precision.
ALTER TABLE "Transaction"
ALTER COLUMN "amount" TYPE DECIMAL(14,2)
USING ROUND(("amount")::numeric, 2);

-- Backfill postedDate from date for all existing rows.
-- Only backfill where null; Plaid-specific fields are left null for legacy rows.
UPDATE "Transaction"
SET "postedDate" = "date"
WHERE "postedDate" IS NULL;

-- CreateIndex: postedDate
CREATE INDEX "Transaction_userId_postedDate_idx" ON "Transaction"("userId", "postedDate");

-- CreateIndex: authorizedDate
CREATE INDEX "Transaction_userId_authorizedDate_idx" ON "Transaction"("userId", "authorizedDate");
