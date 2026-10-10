-- Backfill originalDescription from stored Plaid payloads when present.
-- Does not reset PlaidItem.cursor; later incremental syncs still own live updates.
UPDATE "Transaction"
SET "originalDescription" = "raw"->>'original_description'
WHERE "originalDescription" IS NULL
  AND "raw" IS NOT NULL
  AND "raw"->>'original_description' IS NOT NULL
  AND btrim("raw"->>'original_description') <> '';
