-- The hidden-parent backfill copied transfer/dedupe/Amazon identity onto the
-- new first-leg child. Those belong only on the original bank row.
UPDATE "Transaction"
SET
	"accountFingerprint" = NULL,
	"dedupeFingerprint" = NULL,
	"transferPairId" = NULL,
	"autoHiddenAsTransfer" = false,
	"amazonRetailEnrichedAt" = NULL
WHERE "splitParentId" IS NOT NULL
	AND source = 'MANUAL';
