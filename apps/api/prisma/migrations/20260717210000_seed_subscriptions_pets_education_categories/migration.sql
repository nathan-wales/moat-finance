-- Seed global default categories added for FinanceKit MCC mapping.
-- These existed in prisma/seed.ts but were never applied via migrate deploy.
INSERT INTO "Category" ("id", "userId", "name", "isDefault", "isHidden", "sortOrder")
SELECT 'cat_global_subscriptions', NULL, 'Subscriptions', true, false, 62
WHERE NOT EXISTS (
	SELECT 1 FROM "Category" WHERE "userId" IS NULL AND "name" = 'Subscriptions'
);

INSERT INTO "Category" ("id", "userId", "name", "isDefault", "isHidden", "sortOrder")
SELECT 'cat_global_pets', NULL, 'Pets', true, false, 82
WHERE NOT EXISTS (
	SELECT 1 FROM "Category" WHERE "userId" IS NULL AND "name" = 'Pets'
);

INSERT INTO "Category" ("id", "userId", "name", "isDefault", "isHidden", "sortOrder")
SELECT 'cat_global_education', NULL, 'Education', true, false, 85
WHERE NOT EXISTS (
	SELECT 1 FROM "Category" WHERE "userId" IS NULL AND "name" = 'Education'
);

-- Repair rows that stored the mapped category name but fell back to the
-- Uncategorized FK because the global category row was missing at import time.
UPDATE "Transaction" AS t
SET "categoryId" = mapped.id
FROM "Category" AS mapped
INNER JOIN "Category" AS uncategorized
	ON uncategorized."userId" IS NULL
	AND uncategorized."name" = 'Uncategorized'
WHERE mapped."userId" IS NULL
	AND mapped."name" IN ('Subscriptions', 'Pets', 'Education')
	AND t."category" = mapped."name"
	AND t."categoryId" = uncategorized.id;
