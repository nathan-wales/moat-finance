-- Convert legacy two-way splits (parent is the first visible leg with a reduced
-- amount) into hidden-parent + child-leg rows. Parent keeps the original bank
-- total; a new MANUAL child copies the parent's previous first-leg state.

WITH copied AS (
	INSERT INTO "Transaction" (
		id,
		"userId",
		date,
		"postedDate",
		"authorizedDate",
		amount,
		"isoCurrencyCode",
		"unofficialCurrencyCode",
		type,
		category,
		"categoryId",
		description,
		"originalDescription",
		notes,
		"merchantName",
		account,
		"paymentChannel",
		"importId",
		source,
		"plaidAccountId",
		"plaidItemId",
		"appleFinanceKitAccountId",
		"financialConnectionId",
		"financialAccountId",
		"dataProvider",
		"providerAccountId",
		"accountFingerprint",
		"dedupeFingerprint",
		"sourceAccountId",
		"importBatchId",
		pending,
		hidden,
		"removedAt",
		location,
		raw,
		"rawProviderPayload",
		"splitGroupId",
		"splitParentId",
		"splitOriginalAmount",
		"transferPairId",
		"autoHiddenAsTransfer",
		"amazonRetailEnrichedAt",
		"appliedRuleId",
		"createdAt",
		"updatedAt"
	)
	SELECT
		gen_random_uuid()::text,
		p."userId",
		p.date,
		p."postedDate",
		p."authorizedDate",
		p.amount,
		p."isoCurrencyCode",
		p."unofficialCurrencyCode",
		p.type,
		p.category,
		p."categoryId",
		p.description,
		p."originalDescription",
		p.notes,
		p."merchantName",
		p.account,
		p."paymentChannel",
		NULL,
		'MANUAL',
		p."plaidAccountId",
		p."plaidItemId",
		p."appleFinanceKitAccountId",
		p."financialConnectionId",
		p."financialAccountId",
		p."dataProvider",
		p."providerAccountId",
		p."accountFingerprint",
		p."dedupeFingerprint",
		p."sourceAccountId",
		p."importBatchId",
		false,
		p.hidden,
		p."removedAt",
		p.location,
		p.raw,
		p."rawProviderPayload",
		p.id,
		p.id,
		COALESCE(p."splitOriginalAmount", p.amount),
		p."transferPairId",
		p."autoHiddenAsTransfer",
		p."amazonRetailEnrichedAt",
		p."appliedRuleId",
		NOW(),
		NOW()
	FROM "Transaction" p
	WHERE p."splitGroupId" = p.id
		AND p."splitParentId" IS NULL
		AND p."splitOriginalAmount" IS NOT NULL
		AND p.amount <> p."splitOriginalAmount"
	RETURNING id, "splitParentId"
)
INSERT INTO "TransactionHashtag" ("transactionId", "hashtagId")
SELECT copied.id, th."hashtagId"
FROM copied
INNER JOIN "TransactionHashtag" th ON th."transactionId" = copied."splitParentId"
ON CONFLICT ("transactionId", "hashtagId") DO NOTHING;

UPDATE "Transaction" p
SET amount = p."splitOriginalAmount"
WHERE p."splitGroupId" = p.id
	AND p."splitParentId" IS NULL
	AND p."splitOriginalAmount" IS NOT NULL
	AND p.amount <> p."splitOriginalAmount";
