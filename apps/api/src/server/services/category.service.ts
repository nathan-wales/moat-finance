import { isUngroupedCanonicalCategory } from "@moat/category-mapping";
import {
	type CategoryParent,
	DEFAULT_CUSTOM_CATEGORY_PARENT,
	FALLBACK_CATEGORY_COLOR,
	normalizeHexColor,
	resolveCategoryColor,
} from "@moat/contracts";
import {
	applyCategoryOverride,
	defaultCategoryCapabilities,
	isEmptyCategoryOverride,
} from "@moat/data-access";
import type { Prisma, PrismaClient } from "../../../generated/prisma";

type CategoryLookupDb = {
	category: PrismaClient["category"];
	categoryOverride: PrismaClient["categoryOverride"];
};

type CategoryClient = CategoryLookupDb & {
	transaction: PrismaClient["transaction"];
	transactionRuleAction: PrismaClient["transactionRuleAction"];
	transactionRuleCondition: PrismaClient["transactionRuleCondition"];
};

type CategoryRow = Prisma.CategoryGetPayload<{
	include: { overrides: true };
}>;

export type ResolvedCategory = {
	id: string;
	userId: string | null;
	name: string;
	icon: string | null;
	color: string;
	isDefault: boolean;
	isHidden: boolean;
	isRemoved: boolean;
	sortOrder: number;
	canDelete: boolean;
	canHide: boolean;
	parentCategory: CategoryParent | null;
};

function isDefaultCategory(category: {
	isDefault: boolean;
	userId: string | null;
}): boolean {
	return category.isDefault || category.userId == null;
}

function presentCategory(
	category: {
		id: string;
		userId: string | null;
		name: string;
		icon: string | null;
		color?: string | null;
		isDefault: boolean;
		isHidden: boolean;
		sortOrder: number;
		parentCategory?: CategoryParent | null;
	},
	override?: {
		name: string | null;
		icon: string | null;
		color?: string | null;
		isHidden: boolean | null;
		isRemoved: boolean;
		parentCategory?: CategoryParent | null;
	} | null,
): ResolvedCategory {
	const defaulted = isDefaultCategory(category);
	const resolved = applyCategoryOverride(
		{
			name: category.name,
			icon: category.icon,
			color: category.color ?? null,
			isHidden: category.isHidden,
			isDefault: defaulted,
			parentCategory: category.parentCategory ?? null,
		},
		override,
	);
	return {
		id: category.id,
		userId: category.userId,
		name: resolved.name,
		icon: resolved.icon,
		color: resolved.color,
		isDefault: defaulted,
		isHidden: resolved.isHidden,
		isRemoved: resolved.isRemoved,
		sortOrder: category.sortOrder,
		canDelete: resolved.canDelete,
		canHide: resolved.canHide,
		parentCategory: resolved.parentCategory,
	};
}

function overrideFromRow(category: CategoryRow) {
	return category.overrides[0] ?? null;
}

async function findAccessibleCategory(
	db: CategoryClient,
	userId: string,
	id: string,
) {
	return db.category.findFirst({
		where: {
			id,
			OR: [{ userId: null }, { userId }],
		},
		include: {
			overrides: { where: { userId } },
		},
	});
}

async function upsertOverride(
	db: CategoryClient,
	userId: string,
	categoryId: string,
	patch: {
		name?: string | null;
		icon?: string | null;
		color?: string | null;
		isHidden?: boolean | null;
		isRemoved?: boolean;
		parentCategory?: CategoryParent | null;
	},
) {
	const existing = await db.categoryOverride.findUnique({
		where: { userId_categoryId: { userId, categoryId } },
	});
	const next = {
		name: patch.name !== undefined ? patch.name : (existing?.name ?? null),
		icon: patch.icon !== undefined ? patch.icon : (existing?.icon ?? null),
		color: patch.color !== undefined ? patch.color : (existing?.color ?? null),
		isHidden:
			patch.isHidden !== undefined
				? patch.isHidden
				: (existing?.isHidden ?? null),
		isRemoved:
			patch.isRemoved !== undefined
				? patch.isRemoved
				: (existing?.isRemoved ?? false),
		parentCategory:
			patch.parentCategory !== undefined
				? patch.parentCategory
				: (existing?.parentCategory ?? null),
	};

	if (isEmptyCategoryOverride(next)) {
		if (existing) {
			await db.categoryOverride.delete({ where: { id: existing.id } });
		}
		return;
	}

	await db.categoryOverride.upsert({
		where: { userId_categoryId: { userId, categoryId } },
		create: {
			userId,
			categoryId,
			...next,
		},
		update: next,
	});
}

export function presentCategoryRef(
	category:
		| {
				id: string;
				name: string;
				icon?: string | null;
				color?: string | null;
				isHidden: boolean;
				isDefault: boolean;
				overrides?: Array<{
					name: string | null;
					icon: string | null;
					color?: string | null;
					isHidden: boolean | null;
					isRemoved: boolean;
				}>;
		  }
		| null
		| undefined,
): {
	id: string;
	name: string;
	icon: string | null;
	color: string;
	isHidden: boolean;
	isDefault: boolean;
} | null {
	if (!category) return null;
	const resolved = applyCategoryOverride(
		{
			name: category.name,
			icon: category.icon ?? null,
			color: category.color ?? null,
			isHidden: category.isHidden,
			isDefault: category.isDefault,
		},
		category.overrides?.[0] ?? null,
	);
	return {
		id: category.id,
		name: resolved.name,
		icon: resolved.icon,
		color: resolved.color,
		isHidden: resolved.isHidden,
		isDefault: category.isDefault,
	};
}

export async function listCategories(
	db: CategoryClient,
	userId: string,
): Promise<ResolvedCategory[]> {
	const categories = await db.category.findMany({
		where: { OR: [{ userId: null }, { userId }] },
		include: { overrides: { where: { userId } } },
		orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
	});
	return categories.map((category) =>
		presentCategory(category, overrideFromRow(category)),
	);
}

/**
 * Category names are the join key for rules, agent tools, and every
 * name-keyed spending aggregate, so two categories resolving to the same
 * display name would make those lookups ambiguous.
 */
async function assertDisplayNameAvailable(
	db: CategoryClient,
	userId: string,
	name: string,
	allowedCategoryId?: string,
) {
	const conflict = await findCategoryByDisplayName(db, userId, name);
	if (conflict && conflict.id !== allowedCategoryId) {
		throw new Error("A category with this name already exists");
	}
}

export async function createCategory(
	db: CategoryClient,
	userId: string,
	input: {
		name: string;
		icon?: string | null;
		color?: string;
		parentCategory?: CategoryParent | null;
	},
): Promise<ResolvedCategory> {
	await assertDisplayNameAvailable(db, userId, input.name);
	const created = await db.category.create({
		data: {
			userId,
			name: input.name,
			icon: input.icon ?? null,
			color: input.color
				? normalizeHexColor(input.color)
				: FALLBACK_CATEGORY_COLOR,
			parentCategory: input.parentCategory ?? DEFAULT_CUSTOM_CATEGORY_PARENT,
		},
	});
	return presentCategory(created, null);
}

/**
 * Rules store category names in valueText (not categoryId). When a category is
 * renamed, rewrite this user's SET_CATEGORY actions and CATEGORY conditions so
 * the rules list and later applies stay in sync.
 */
async function rewriteRuleCategoryNames(
	db: CategoryClient,
	userId: string,
	fromNames: string[],
	toName: string,
) {
	const normalizedTo = toName.trim();
	if (!normalizedTo) return;

	const uniqueFrom = [
		...new Set(
			fromNames
				.map((name) => name.trim())
				.filter(
					(name) =>
						name.length > 0 &&
						name.toLowerCase() !== normalizedTo.toLowerCase(),
				),
		),
	];
	if (uniqueFrom.length === 0) return;

	for (const fromName of uniqueFrom) {
		await db.transactionRuleAction.updateMany({
			where: {
				type: "SET_CATEGORY",
				valueText: { equals: fromName, mode: "insensitive" },
				rule: { userId },
			},
			data: { valueText: normalizedTo },
		});
		await db.transactionRuleCondition.updateMany({
			where: {
				field: "CATEGORY",
				valueText: { equals: fromName, mode: "insensitive" },
				rule: { userId },
			},
			data: { valueText: normalizedTo },
		});
	}
}

export async function updateCategory(
	db: CategoryClient,
	userId: string,
	input: {
		id: string;
		name: string;
		icon?: string | null;
		color?: string;
		parentCategory?: CategoryParent | null;
	},
): Promise<ResolvedCategory> {
	const category = await findAccessibleCategory(db, userId, input.id);
	if (!category) throw new Error("Category not found");

	await assertDisplayNameAvailable(db, userId, input.name, category.id);

	const previousDisplayName = presentCategory(
		category,
		overrideFromRow(category),
	).name;
	const nameChanged =
		previousDisplayName.toLowerCase() !== input.name.trim().toLowerCase();
	const nextParent = resolveParentCategoryForUpdate(
		category,
		input.parentCategory,
	);

	if (isDefaultCategory(category)) {
		// Store null when the value matches the shared row so the overlay stays
		// sparse and the user keeps inheriting future canonical changes.
		const icon = input.icon ?? null;
		const color =
			input.color !== undefined ? normalizeHexColor(input.color) : undefined;
		await upsertOverride(db, userId, category.id, {
			name: input.name === category.name ? null : input.name,
			icon: icon === category.icon ? null : icon,
			...(color !== undefined
				? {
						color:
							color === resolveCategoryColor(category.color) ? null : color,
					}
				: {}),
			...(input.parentCategory !== undefined
				? {
						parentCategory:
							nextParent === (category.parentCategory ?? null)
								? null
								: nextParent,
					}
				: {}),
		});
		if (nameChanged) {
			const fromNames = [previousDisplayName];
			if (category.name.toLowerCase() !== previousDisplayName.toLowerCase()) {
				fromNames.push(category.name);
			}
			await rewriteRuleCategoryNames(db, userId, fromNames, input.name);
		}
		const updated = await findAccessibleCategory(db, userId, category.id);
		if (!updated) throw new Error("Category not found");
		return presentCategory(updated, overrideFromRow(updated));
	}

	if (category.userId !== userId) throw new Error("Category not found");

	const updated = await db.category.update({
		where: { id: input.id },
		data: {
			name: input.name,
			...(input.icon !== undefined ? { icon: input.icon } : {}),
			...(input.color !== undefined
				? { color: normalizeHexColor(input.color) }
				: {}),
			...(input.parentCategory !== undefined
				? { parentCategory: nextParent }
				: {}),
		},
	});
	if (nameChanged) {
		await rewriteRuleCategoryNames(
			db,
			userId,
			[previousDisplayName],
			input.name,
		);
	}
	return presentCategory(updated, null);
}

function resolveParentCategoryForUpdate(
	category: {
		name: string;
		isDefault: boolean;
		userId: string | null;
		parentCategory?: CategoryParent | null;
	},
	requested?: CategoryParent | null,
): CategoryParent | null {
	if (
		isDefaultCategory(category) &&
		isUngroupedCanonicalCategory(category.name)
	) {
		return null;
	}
	if (requested === undefined) {
		return category.parentCategory ?? DEFAULT_CUSTOM_CATEGORY_PARENT;
	}
	if (requested === null) {
		return isDefaultCategory(category) ? null : DEFAULT_CUSTOM_CATEGORY_PARENT;
	}
	return requested;
}

export async function deleteCategory(
	db: CategoryClient,
	userId: string,
	id: string,
): Promise<{ success: true }> {
	const category = await findAccessibleCategory(db, userId, id);
	if (!category) throw new Error("Category not found");

	if (isDefaultCategory(category)) {
		const capabilities = defaultCategoryCapabilities(category.name, true);
		if (!capabilities.canDelete) {
			throw new Error("This category cannot be removed");
		}
		await upsertOverride(db, userId, category.id, {
			isHidden: true,
			isRemoved: true,
		});
		return { success: true };
	}

	if (category.userId !== userId) throw new Error("Category not found");

	const uncategorized = await db.category.findFirst({
		where: { userId: null, name: "Uncategorized" },
	});
	if (uncategorized) {
		// The denormalized string has to move too: spending aggregation falls
		// back to it for Uncategorized rows, so leaving it behind keeps the
		// deleted category showing up as a spend bucket forever.
		await db.transaction.updateMany({
			where: { categoryId: id, userId },
			data: { categoryId: uncategorized.id, category: uncategorized.name },
		});
	}
	await db.category.delete({ where: { id } });
	return { success: true };
}

export async function toggleCategoryHidden(
	db: CategoryClient,
	userId: string,
	input: { id: string; isHidden: boolean },
): Promise<{ success: true }> {
	const category = await findAccessibleCategory(db, userId, input.id);
	if (!category) throw new Error("Category not found");

	if (isDefaultCategory(category)) {
		const capabilities = defaultCategoryCapabilities(category.name, true);
		if (!capabilities.canHide && input.isHidden) {
			throw new Error("This category cannot be hidden");
		}
		await upsertOverride(db, userId, category.id, {
			isHidden: input.isHidden ? true : null,
			isRemoved: input.isHidden ? undefined : false,
		});
		return { success: true };
	}

	if (category.userId !== userId) throw new Error("Category not found");

	await db.category.update({
		where: { id: input.id },
		data: { isHidden: input.isHidden },
	});
	return { success: true };
}

export type ResolvedCategoryMatch = {
	id: string;
	userId: string | null;
	/** Canonical `Category.name`, written to the denormalized column. */
	name: string;
	/** What this user sees for the category. */
	displayName: string;
};

function toCategoryMatch(
	category: { id: string; userId: string | null; name: string },
	overrideName?: string | null,
): ResolvedCategoryMatch {
	return {
		id: category.id,
		userId: category.userId,
		name: category.name,
		displayName: overrideName ?? category.name,
	};
}

/**
 * Resolves a free-text category name — from a rule action, an agent tool, or a
 * transaction edit — to a category the user can actually use.
 *
 * A renamed default has to be reachable by both spellings: rules written after
 * the rename carry the display name, rules written before it carry the
 * canonical name. Overrides win so the name the user currently sees is
 * authoritative; among canonical matches, user-owned beats global and live
 * beats tombstoned so the result never depends on row order.
 */
export async function findCategoryByDisplayName(
	db: CategoryLookupDb,
	userId: string,
	categoryName: string,
): Promise<ResolvedCategoryMatch | null> {
	const trimmedName = categoryName.trim();
	if (!trimmedName) return null;

	const overrideMatch = await db.categoryOverride.findFirst({
		where: {
			userId,
			name: { equals: trimmedName, mode: "insensitive" },
			isRemoved: false,
			category: { OR: [{ userId: null }, { userId }] },
		},
		include: { category: true },
		orderBy: { createdAt: "asc" },
	});
	if (overrideMatch?.category) {
		return toCategoryMatch(overrideMatch.category, overrideMatch.name);
	}

	const candidates = await db.category.findMany({
		where: {
			name: { equals: trimmedName, mode: "insensitive" },
			OR: [{ userId }, { userId: null }],
		},
		include: { overrides: { where: { userId } } },
	});
	if (candidates.length === 0) return null;

	const ranked = [...candidates].sort(
		(left, right) =>
			categoryMatchRank(left, userId) - categoryMatchRank(right, userId),
	);
	const best = ranked[0];
	if (!best) return null;
	return toCategoryMatch(best, best.overrides[0]?.name);
}

function categoryMatchRank(
	category: {
		userId: string | null;
		overrides: Array<{ isRemoved: boolean }>;
	},
	userId: string,
): number {
	const removed = category.overrides[0]?.isRemoved === true;
	const owned = category.userId === userId;
	return (removed ? 2 : 0) + (owned ? 0 : 1);
}

/**
 * Maps categoryId → the current user's display name, for the few code paths
 * that resolve many transactions at once and can't afford a per-row include.
 */
export async function loadCategoryOverrideNames(
	db: Pick<CategoryLookupDb, "categoryOverride">,
	userId: string,
): Promise<Map<string, string>> {
	const overrides = await db.categoryOverride.findMany({
		where: { userId, name: { not: null } },
		select: { categoryId: true, name: true },
	});
	return new Map(
		overrides.flatMap((override) =>
			override.name ? [[override.categoryId, override.name] as const] : [],
		),
	);
}
