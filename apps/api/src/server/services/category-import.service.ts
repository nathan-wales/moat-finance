import { logger } from "~/lib/logger";
import { db } from "~/server/db";

const PROVIDER_MAPPED_GLOBAL_DEFAULTS = [
	{ name: "Subscriptions", sortOrder: 62 },
	{ name: "Pets", sortOrder: 82 },
	{ name: "Education", sortOrder: 85 },
] as const;

export function buildCategoryNameToIdMap(
	categories: Array<{ id: string; name: string; userId: string | null }>,
): Map<string, string> {
	const categoryNameToId = new Map<string, string>();

	for (const category of categories) {
		if (category.userId !== null) continue;
		categoryNameToId.set(category.name.toLowerCase(), category.id);
	}

	for (const category of categories) {
		if (category.userId === null) continue;
		categoryNameToId.set(category.name.toLowerCase(), category.id);
	}

	return categoryNameToId;
}

async function ensureProviderMappedGlobalCategories(
	categoryNameToId: Map<string, string>,
): Promise<void> {
	for (const required of PROVIDER_MAPPED_GLOBAL_DEFAULTS) {
		const key = required.name.toLowerCase();
		if (categoryNameToId.has(key)) continue;

		const created = await db.category.create({
			data: {
				userId: null,
				name: required.name,
				isDefault: true,
				sortOrder: required.sortOrder,
			},
			select: { id: true },
		});

		categoryNameToId.set(key, created.id);
		logger.warn(
			"Created missing global default category for provider mapping",
			{
				feature: "category-import",
				operation: "ensureProviderMappedGlobalCategories",
				categoryName: required.name,
			},
		);
	}
}

export async function loadCategoryNameToIdMap(userId: string): Promise<{
	categoryNameToId: Map<string, string>;
	uncategorizedCategoryId: string;
}> {
	const categories = await db.category.findMany({
		where: { OR: [{ userId: null }, { userId }] },
		select: { id: true, name: true, userId: true },
	});

	const categoryNameToId = buildCategoryNameToIdMap(categories);
	await ensureProviderMappedGlobalCategories(categoryNameToId);

	const uncategorizedCategoryId = categoryNameToId.get("uncategorized");
	if (!uncategorizedCategoryId) {
		throw new Error(
			`No "Uncategorized" category found for user ${userId}; ` +
				"seed must include a global Uncategorized category.",
		);
	}

	return { categoryNameToId, uncategorizedCategoryId };
}
