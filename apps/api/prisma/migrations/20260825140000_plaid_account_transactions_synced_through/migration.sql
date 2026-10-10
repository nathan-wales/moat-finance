-- AlterTable
ALTER TABLE "PlaidAccount" ADD COLUMN "transactionsSyncedThrough" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN "transactionsSyncedThrough" TIMESTAMP(3);

-- Backfill from existing posted history (aggregate, not per-incoming-tx scans).
UPDATE "PlaidAccount" AS pa
SET "transactionsSyncedThrough" = (
    SELECT MAX(t.date)
    FROM "Transaction" AS t
    WHERE t."plaidAccountId" = pa.id
      AND t."removedAt" IS NULL
);

UPDATE "FinancialAccount" AS fa
SET "transactionsSyncedThrough" = (
    SELECT MAX(t.date)
    FROM "Transaction" AS t
    WHERE t."financialAccountId" = fa.id
      AND t."removedAt" IS NULL
);
