import type { McpAuthContext } from "~/auth/types";

export type ResolvedCategory = {
	id: string;
	/** Canonical `Category.name`, written to the denormalized column. */
	name: string;
	/** What this user sees for the category. */
	displayName: string;
};

/**
 * Mirrors `findCategoryByDisplayName` in the API: a renamed default must be
 * reachable by both its per-user display name and its canonical name, with
 * overrides winning and user-owned rows beating global ones.
 */
async function findCategoryByDisplayName(
	context: McpAuthContext,
	categoryName: string,
): Promise<ResolvedCategory | null> {
	const overrideMatch = await context.db.categoryOverride.findFirst({
		where: {
			userId: context.userId,
			name: { equals: categoryName, mode: "insensitive" },
			isRemoved: false,
			category: { OR: [{ userId: null }, { userId: context.userId }] },
		},
		select: { name: true, category: { select: { id: true, name: true } } },
		orderBy: { createdAt: "asc" },
	});
	if (overrideMatch) {
		return {
			id: overrideMatch.category.id,
			name: overrideMatch.category.name,
			displayName: overrideMatch.name ?? overrideMatch.category.name,
		};
	}

	const candidates = await context.db.category.findMany({
		where: {
			name: { equals: categoryName, mode: "insensitive" },
			OR: [{ userId: context.userId }, { userId: null }],
		},
		select: {
			id: true,
			name: true,
			userId: true,
			overrides: {
				where: { userId: context.userId },
				select: { name: true, isRemoved: true },
			},
		},
	});
	const best = candidates.sort((left, right) => {
		const rank = (candidate: (typeof candidates)[number]) =>
			(candidate.overrides[0]?.isRemoved ? 2 : 0) +
			(candidate.userId === context.userId ? 0 : 1);
		return rank(left) - rank(right);
	})[0];
	if (!best) return null;

	return {
		id: best.id,
		name: best.name,
		displayName: best.overrides[0]?.name ?? best.name,
	};
}

export async function resolveCategoryByIdOrName(
	context: McpAuthContext,
	input: { categoryId?: string; categoryName?: string },
): Promise<ResolvedCategory> {
	if (input.categoryId) {
		const category = await context.db.category.findFirst({
			where: {
				id: input.categoryId,
				OR: [{ userId: null }, { userId: context.userId }],
			},
			select: {
				id: true,
				name: true,
				overrides: {
					where: { userId: context.userId },
					select: { name: true },
				},
			},
		});
		if (!category) {
			throw new Error("Category not found");
		}
		return {
			id: category.id,
			name: category.name,
			displayName: category.overrides[0]?.name ?? category.name,
		};
	}

	const categoryName = input.categoryName?.trim();
	if (!categoryName) {
		throw new Error("Provide either categoryId or categoryName");
	}

	const category = await findCategoryByDisplayName(context, categoryName);
	if (!category) {
		throw new Error("Category not found");
	}
	return category;
}

export async function resolveOrCreateCategoryByName(
	context: McpAuthContext,
	categoryName: string,
): Promise<ResolvedCategory> {
	const trimmedName = categoryName.trim();
	const existing = await findCategoryByDisplayName(context, trimmedName);
	if (existing) return existing;

	const created = await context.db.category.create({
		data: { userId: context.userId, name: trimmedName },
		select: { id: true, name: true },
	});
	return { id: created.id, name: created.name, displayName: created.name };
}

export function normalizeHashtagName(name: string): string {
	return name.replace(/^#/, "").toLowerCase().trim();
}

export function displayHashtagName(name: string): string {
	return name.replace(/^#/, "").trim();
}
