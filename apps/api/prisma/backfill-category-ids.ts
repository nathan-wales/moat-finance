/**
 * Backfill script: resolves Transaction.categoryId for every row that has
 * a category name (e.g. "Shopping") but a null categoryId.
 *
 * Context: before the import-time fix in apps/api/src/server/plaid/mapping.ts,
 * Plaid-imported transactions only had `category` (string) populated and
 * `categoryId` (FK) was always null. Analytics endpoints that filter or
 * join on `categoryId` therefore returned wrong/empty data.
 *
 * Strategy:
 *   - For each user with null-categoryId rows, load that user's accessible
 *     categories (global + user-owned) and build a name → id map.
 *   - For each distinct (userId, category) pair, run a single updateMany
 *     to populate categoryId. This is O(distinct categories per user)
 *     queries instead of O(transactions).
 *   - Names with no matching seeded category fall back to Uncategorized
 *     (matches the runtime behavior in mapping.ts).
 *
 * Run with:
 *   cd apps/api && npx tsx prisma/backfill-category-ids.ts
 *
 * Idempotent: only touches rows where categoryId IS NULL.
 */
import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

/**
 * Global default categories that must exist before backfill runs.
 * If missing (because the user's seed predates them), they are created.
 */
const REQUIRED_GLOBAL_DEFAULTS: { name: string; sortOrder: number }[] = [
	{ name: "Transfer", sortOrder: 998 },
	{ name: "Credit card payment", sortOrder: 150 },
];

/**
 * Legacy category-string aliases. Plaid imports historically wrote these
 * names; the canonical seeded category uses a different name. Keys are
 * lowercased for case-insensitive lookup.
 */
const LEGACY_NAME_ALIASES: Record<string, string> = {
	income: "Salary",
	donations: "Gifts & Donations",
	other: "Uncategorized",
};

async function ensureRequiredGlobalDefaults() {
	for (const def of REQUIRED_GLOBAL_DEFAULTS) {
		const existing = await db.category.findFirst({
			where: { userId: null, name: def.name },
		});
		if (!existing) {
			await db.category.create({
				data: {
					userId: null,
					name: def.name,
					sortOrder: def.sortOrder,
					isDefault: true,
				},
			});
			console.log(`Created missing global default: ${def.name}`);
		}
	}
}

async function main() {
	await ensureRequiredGlobalDefaults();

	// Collect every userId that has either:
	//   - a row with no categoryId, or
	//   - a row already pointing at the user's Uncategorized id (eligible for
	//     re-resolution after new defaults / aliases were added).
	const usersToProcess = await db.transaction.findMany({
		where: {
			OR: [
				{ categoryId: null },
				{
					categoryRef: {
						name: { equals: "Uncategorized", mode: "insensitive" },
					},
				},
			],
		},
		select: { userId: true },
		distinct: ["userId"],
	});

	console.log(
		`Found ${usersToProcess.length} user(s) with rows eligible for backfill`,
	);

	let totalUpdated = 0;
	let totalFallback = 0;
	let totalMatched = 0;
	let totalAliased = 0;

	for (const { userId } of usersToProcess) {
		const categories = await db.category.findMany({
			where: { OR: [{ userId: null }, { userId }] },
			select: { id: true, name: true },
		});

		const nameToId = new Map<string, string>(
			categories.map((c) => [c.name.toLowerCase(), c.id]),
		);
		const uncategorizedId = nameToId.get("uncategorized");

		if (!uncategorizedId) {
			console.warn(
				`  [userId=${userId.slice(0, 8)}] No "Uncategorized" category — skipping user`,
			);
			continue;
		}

		// Process both null-categoryId rows and rows currently set to Uncategorized
		// (the latter so we can re-route legacy fallbacks now that better matches exist).
		const distinctCategories = await db.transaction.findMany({
			where: {
				userId,
				OR: [{ categoryId: null }, { categoryId: uncategorizedId }],
			},
			select: { category: true },
			distinct: ["category"],
		});

		console.log(
			`  [userId=${userId.slice(0, 8)}] ${distinctCategories.length} distinct category name(s) to backfill`,
		);

		for (const { category } of distinctCategories) {
			const aliasedName = LEGACY_NAME_ALIASES[category.toLowerCase()];
			const canonicalName = aliasedName ?? category;
			const matchedId = nameToId.get(canonicalName.toLowerCase());
			const resolvedId = matchedId ?? uncategorizedId;
			const isAliased = !!aliasedName && !!matchedId;

			// Skip rows currently set to Uncategorized whose best match is still
			// Uncategorized — there's nothing to change unless an alias should
			// rewrite legacy category text such as OTHER.
			if (resolvedId === uncategorizedId && !isAliased) {
				const result = await db.transaction.updateMany({
					where: { userId, categoryId: null, category },
					data: { categoryId: uncategorizedId },
				});
				totalUpdated += result.count;
				totalFallback += result.count;
				if (result.count > 0) {
					console.log(
						`    "${category}" → Uncategorized (fallback) (${result.count} rows)`,
					);
				}
				continue;
			}

			// Update both null-categoryId and previously-Uncategorized rows for
			// this category text. Rewrite category text when alias was applied.
			const result = await db.transaction.updateMany({
				where: {
					userId,
					category,
					OR: [{ categoryId: null }, { categoryId: uncategorizedId }],
				},
				data: isAliased
					? { categoryId: resolvedId, category: canonicalName }
					: { categoryId: resolvedId },
			});

			totalUpdated += result.count;
			totalMatched += result.count;
			if (isAliased) totalAliased += result.count;

			// Count how many of those were re-resolutions (previously Uncategorized).
			// Best-effort: a separate count would require an extra query; skip detail.

			const label = isAliased
				? `aliased "${category}" → "${canonicalName}" (${matchedId.slice(0, 8)})`
				: `matched ${resolvedId.slice(0, 8)}`;
			console.log(`    "${category}" → ${label} (${result.count} rows)`);
		}
	}

	console.log(
		`\nDone. Updated ${totalUpdated} transaction(s) total: ${totalMatched} matched, ${totalFallback} stayed Uncategorized, ${totalAliased} aliased to canonical name.`,
	);
}

main()
	.catch((e) => {
		console.error("Backfill failed:", e);
		process.exit(1);
	})
	.finally(() => db.$disconnect());
