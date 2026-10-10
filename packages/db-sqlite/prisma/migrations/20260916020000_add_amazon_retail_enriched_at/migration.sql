-- Stamp bank transactions that were linked to scraped Amazon order items.
ALTER TABLE "Transaction" ADD COLUMN "amazonRetailEnrichedAt" DATETIME;

UPDATE "Transaction"
SET "amazonRetailEnrichedAt" = (
  SELECT MIN("matchedAt")
  FROM "RetailOrderItem"
  WHERE "RetailOrderItem"."transactionId" = "Transaction"."id"
    AND "RetailOrderItem"."matchStatus" = 'linked'
)
WHERE "amazonRetailEnrichedAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "RetailOrderItem"
    WHERE "RetailOrderItem"."transactionId" = "Transaction"."id"
      AND "RetailOrderItem"."matchStatus" = 'linked'
  );
