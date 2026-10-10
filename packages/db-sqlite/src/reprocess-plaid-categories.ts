import { mapPlaidCategory } from "@moat/category-mapping";
import type { SqliteDbClient } from "./db-client";

const REPROCESS_META_KEY = "plaid_category_reprocess_v1";

type UncategorizedPlaidRow = {
	id: string;
	userId: string;
	raw: string | null;
};

/**
 * One-shot: remaps PLAID transactions stuck on Uncategorized after the
 * taxonomy alignment, using personal_finance_category from stored raw JSON.
 * Idempotent via UserMetadata flag; safe if re-run (only touches Uncategorized).
 */
export async function reprocessUncategorizedPlaidCategories(
	db: SqliteDbClient,
): Promise<{ updatedCount: number }> {
	const alreadyRan = await db.$queryRaw<Array<{ id: string }>>`
		SELECT "id" FROM "UserMetadata"
		WHERE "userId" = 'local-user' AND "key" = ${REPROCESS_META_KEY}
		LIMIT 1
	`;
	if (alreadyRan.length > 0) {
		return { updatedCount: 0 };
	}

	const categories = await db.$queryRaw<
		Array<{ id: string; name: string; userId: string | null }>
	>`
		SELECT "id", "name", "userId" FROM "Category"
	`;

	const categoryNameToId = new Map<string, string>();
	for (const category of categories) {
		if (category.userId !== null) continue;
		categoryNameToId.set(category.name.toLowerCase(), category.id);
	}
	for (const category of categories) {
		if (category.userId === null) continue;
		categoryNameToId.set(category.name.toLowerCase(), category.id);
	}

	const uncategorizedCategoryId = categoryNameToId.get("uncategorized");
	if (!uncategorizedCategoryId) {
		return { updatedCount: 0 };
	}

	const rows = await db.$queryRaw<UncategorizedPlaidRow[]>`
		SELECT t."id", t."userId", t."raw"
		FROM "Transaction" t
		WHERE t."source" = 'PLAID'
			AND t."removedAt" IS NULL
			AND (
				t."categoryId" IS NULL
				OR t."categoryId" = ${uncategorizedCategoryId}
			)
	`;

	let updatedCount = 0;
	const now = new Date().toISOString();

	for (const row of rows) {
		if (!row.raw) continue;

		let parsed: unknown;
		try {
			parsed = JSON.parse(row.raw);
		} catch {
			continue;
		}

		if (!parsed || typeof parsed !== "object") continue;

		const mappedName = mapPlaidCategory(
			parsed as {
				personal_finance_category?: {
					primary?: string | null;
					detailed?: string | null;
				} | null;
			},
		);
		if (mappedName === "Uncategorized") continue;

		const resolvedCategoryId =
			categoryNameToId.get(mappedName.toLowerCase()) ?? null;
		if (!resolvedCategoryId || resolvedCategoryId === uncategorizedCategoryId) {
			continue;
		}

		await db.$executeRaw`
			UPDATE "Transaction"
			SET "categoryId" = ${resolvedCategoryId}, "updatedAt" = ${now}
			WHERE "id" = ${row.id}
		`;
		updatedCount += 1;
	}

	const metaId = `meta_${REPROCESS_META_KEY}`;
	await db.$executeRaw`
		INSERT OR IGNORE INTO "UserMetadata" ("id", "userId", "key", "valueJson", "createdAt", "updatedAt")
		VALUES (
			${metaId},
			'local-user',
			${REPROCESS_META_KEY},
			${JSON.stringify({ updatedCount, completedAt: now })},
			${now},
			${now}
		)
	`;

	return { updatedCount };
}
