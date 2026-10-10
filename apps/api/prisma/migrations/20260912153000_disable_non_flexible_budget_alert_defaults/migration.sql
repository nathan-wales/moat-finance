-- Stock 75% / empty alerts stay on for flexible categories only.
-- Fixed and non-monthly rows that still have the original default thresholds
-- are turned off; customized thresholds on those parents are left alone.
-- Postgres forbids referencing the UPDATE target in FROM/JOIN ON, so the
-- per-user override is resolved with a correlated subquery instead.
UPDATE "CategoryBudget" AS cb
SET "alertsEnabled" = false
FROM "Category" AS c
WHERE cb."categoryId" = c.id
	AND cb."alertsEnabled" = true
	AND cb."alertThresholds" = '[75, 100]'::jsonb
	AND COALESCE(
		(
			SELECT o."parentCategory"
			FROM "CategoryOverride" AS o
			WHERE o."categoryId" = c.id
				AND o."userId" = cb."userId"
		),
		c."parentCategory"
	) IN ('FIXED', 'NON_MONTHLY');
