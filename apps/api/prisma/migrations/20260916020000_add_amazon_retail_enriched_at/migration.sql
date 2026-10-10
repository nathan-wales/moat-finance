-- Stamp bank transactions that were linked to scraped Amazon order items.
ALTER TABLE "Transaction" ADD COLUMN "amazonRetailEnrichedAt" TIMESTAMP(3);

UPDATE "Transaction" t
SET "amazonRetailEnrichedAt" = linked."matchedAt"
FROM (
  SELECT "transactionId", MIN("matchedAt") AS "matchedAt"
  FROM "RetailOrderItem"
  WHERE "transactionId" IS NOT NULL AND "matchStatus" = 'linked'
  GROUP BY "transactionId"
) linked
WHERE t."id" = linked."transactionId";
