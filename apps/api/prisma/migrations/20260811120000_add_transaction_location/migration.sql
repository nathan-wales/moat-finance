-- AlterTable: persist Plaid location enrichment on transactions
ALTER TABLE "Transaction" ADD COLUMN "location" JSONB;

-- Backfill from stored Plaid payloads when present
UPDATE "Transaction"
SET "location" = "raw"->'location'
WHERE "location" IS NULL
  AND "raw" IS NOT NULL
  AND "raw" ? 'location'
  AND "raw"->'location' IS NOT NULL
  AND "raw"->'location' <> 'null'::jsonb;
