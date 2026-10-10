import { randomUUID } from "node:crypto";
import {
	CANONICAL_DEFAULT_CATEGORIES,
	isUngroupedCanonicalCategory,
} from "@moat/category-mapping";
import type { CategoryParent } from "@moat/contracts";
import {
	DEFAULT_CUSTOM_CATEGORY_PARENT,
	FALLBACK_CATEGORY_COLOR,
	normalizeHexColor,
	resolveCategoryColor,
} from "@moat/contracts";
import type { CategoryRepository, CategorySummary } from "@moat/data-access";
import {
	applyCategoryOverride,
	defaultCategoryCapabilities,
	isEmptyCategoryOverride,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type CategoryRow = {
	id: string;
	name: string;
	icon: string | null;
	color: string | null;
	userId: string | null;
	isHidden: number | boolean;
	sortOrder: number;
	parentCategory: string | null;
};

type OverrideRow = {
	id: string;
	userId: string;
	categoryId: string;
	name: string | null;
	icon: string | null;
	color: string | null;
	isHidden: number | boolean | null;
	isRemoved: number | boolean;
	parentCategory: string | null;
};

function isDefaultCategory(row: CategoryRow): boolean {
	return row.userId === null;
}

function resolveParentCategoryForUpdate(
	category: CategoryRow,
	requested?: CategoryParent | null,
): CategoryParent | null {
	if (
		isDefaultCategory(category) &&
		isUngroupedCanonicalCategory(category.name)
	) {
		return null;
	}
	if (requested === undefined) {
		return (
			(category.parentCategory as CategoryParent | null) ??
			DEFAULT_CUSTOM_CATEGORY_PARENT
		);
	}
	if (requested === null) {
		return isDefaultCategory(category) ? null : DEFAULT_CUSTOM_CATEGORY_PARENT;
	}
	return requested;
}

function mapCategory(
	row: CategoryRow,
	override?: OverrideRow | null,
): CategorySummary {
	const resolved = applyCategoryOverride(
		{
			name: row.name,
			icon: row.icon ?? null,
			color: row.color ?? null,
			isHidden: Boolean(row.isHidden),
			isDefault: isDefaultCategory(row),
			parentCategory: (row.parentCategory as CategoryParent | null) ?? null,
		},
		override
			? {
					name: override.name,
					icon: override.icon,
					color: override.color,
					isHidden:
						override.isHidden == null ? null : Boolean(override.isHidden),
					isRemoved: Boolean(override.isRemoved),
					parentCategory:
						(override.parentCategory as CategoryParent | null) ?? null,
				}
			: null,
	);
	return {
		id: row.id,
		name: resolved.name,
		icon: resolved.icon,
		color: resolved.color,
		isHidden: resolved.isHidden,
		isDefault: isDefaultCategory(row),
		sortOrder: row.sortOrder,
		isRemoved: resolved.isRemoved,
		canDelete: resolved.canDelete,
		canHide: resolved.canHide,
		parentCategory: resolved.parentCategory,
	};
}

export class SqliteCategoryRepository implements CategoryRepository {
	constructor(private db: SqliteDbClient) {}

	private async findOverride(
		userId: string,
		categoryId: string,
	): Promise<OverrideRow | null> {
		return (await this.db.categoryOverride.findFirst({
			where: { userId, categoryId },
		})) as OverrideRow | null;
	}

	private async upsertOverride(
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
	): Promise<void> {
		const existing = await this.findOverride(userId, categoryId);
		const next = {
			name: patch.name !== undefined ? patch.name : (existing?.name ?? null),
			icon: patch.icon !== undefined ? patch.icon : (existing?.icon ?? null),
			color:
				patch.color !== undefined ? patch.color : (existing?.color ?? null),
			isHidden:
				patch.isHidden !== undefined
					? patch.isHidden
					: existing?.isHidden == null
						? null
						: Boolean(existing.isHidden),
			isRemoved:
				patch.isRemoved !== undefined
					? patch.isRemoved
					: Boolean(existing?.isRemoved),
			parentCategory:
				patch.parentCategory !== undefined
					? patch.parentCategory
					: ((existing?.parentCategory as CategoryParent | null) ?? null),
		};

		if (isEmptyCategoryOverride(next)) {
			if (existing) {
				await this.db.categoryOverride.delete({ where: { id: existing.id } });
			}
			return;
		}

		await this.db.categoryOverride.upsert({
			where: {
				userId_categoryId: { userId, categoryId },
			},
			create: {
				id: randomUUID(),
				userId,
				categoryId,
				...next,
			},
			update: next,
		});
	}

	async listAll(input: {
		userId: string;
		includeHidden?: boolean;
	}): Promise<CategorySummary[]> {
		const [rows, overrides] = await Promise.all([
			this.db.category.findMany({
				where: {
					OR: [{ userId: null }, { userId: input.userId }],
				},
				orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
			}) as Promise<CategoryRow[]>,
			this.db.categoryOverride.findMany({
				where: { userId: input.userId },
			}) as Promise<OverrideRow[]>,
		]);
		const overrideByCategoryId = new Map(
			overrides.map((override) => [override.categoryId, override]),
		);
		return rows
			.map((row) => mapCategory(row, overrideByCategoryId.get(row.id)))
			.filter((category) => input.includeHidden || !category.isHidden);
	}

	async findOrCreate(input: {
		userId: string;
		name: string;
		icon?: string | null;
		color?: string;
		parentCategory?: CategoryParent | null;
	}): Promise<CategorySummary> {
		const name = input.name.trim();
		if (!name) throw new Error("Category name is required");

		const overrideMatch = (await this.db.categoryOverride.findFirst({
			where: { userId: input.userId, name, isRemoved: false },
		})) as OverrideRow | null;
		if (overrideMatch) {
			const existing = (await this.db.category.findFirst({
				where: { id: overrideMatch.categoryId },
			})) as CategoryRow | null;
			if (existing) return mapCategory(existing, overrideMatch);
		}

		const existing = (await this.db.category.findFirst({
			where: { name, OR: [{ userId: null }, { userId: input.userId }] },
		})) as CategoryRow | null;

		if (existing) {
			const override = await this.findOverride(input.userId, existing.id);
			return mapCategory(existing, override);
		}

		const row = (await this.db.category.create({
			data: {
				id: randomUUID(),
				name,
				icon: input.icon ?? null,
				color: input.color
					? normalizeHexColor(input.color)
					: FALLBACK_CATEGORY_COLOR,
				userId: input.userId,
				isHidden: false,
				sortOrder: 999,
				parentCategory: input.parentCategory ?? DEFAULT_CUSTOM_CATEGORY_PARENT,
			},
		})) as CategoryRow;

		return mapCategory(row, null);
	}

	async create(input: {
		userId: string;
		name: string;
		icon?: string | null;
		color?: string;
		parentCategory?: CategoryParent | null;
	}): Promise<CategorySummary> {
		return this.findOrCreate(input);
	}

	private async rewriteRuleCategoryNames(input: {
		userId: string;
		fromNames: string[];
		toName: string;
	}): Promise<void> {
		const normalizedTo = input.toName.trim();
		if (!normalizedTo) return;

		const uniqueFrom = [
			...new Set(
				input.fromNames
					.map((name) => name.trim())
					.filter(
						(name) =>
							name.length > 0 &&
							name.toLowerCase() !== normalizedTo.toLowerCase(),
					),
			),
		];
		if (uniqueFrom.length === 0) return;

		const now = new Date().toISOString();
		for (const fromName of uniqueFrom) {
			await this.db.$executeRaw`
				UPDATE "RuleAction"
				SET "valueText" = ${normalizedTo}, "updatedAt" = ${now}
				WHERE "type" = 'SET_CATEGORY'
					AND "valueText" COLLATE NOCASE = ${fromName}
					AND "ruleId" IN (
						SELECT "id" FROM "TransactionRule" WHERE "userId" = ${input.userId}
					)
			`;
			await this.db.$executeRaw`
				UPDATE "RuleCondition"
				SET "valueText" = ${normalizedTo}, "updatedAt" = ${now}
				WHERE "field" = 'CATEGORY'
					AND "valueText" COLLATE NOCASE = ${fromName}
					AND "ruleId" IN (
						SELECT "id" FROM "TransactionRule" WHERE "userId" = ${input.userId}
					)
			`;
		}
	}

	async update(input: {
		userId: string;
		id: string;
		name: string;
		icon?: string | null;
		color?: string;
		parentCategory?: CategoryParent | null;
	}): Promise<CategorySummary> {
		const existing = (await this.db.category.findFirst({
			where: {
				id: input.id,
				OR: [{ userId: null }, { userId: input.userId }],
			},
		})) as CategoryRow | null;
		if (!existing) throw new Error("Category not found");
		const name = input.name.trim();
		if (!name) throw new Error("Category name is required");

		const conflict = (
			await this.listAll({ userId: input.userId, includeHidden: true })
		).find(
			(category) =>
				category.id !== input.id &&
				!category.isRemoved &&
				category.name.toLowerCase() === name.toLowerCase(),
		);
		if (conflict) throw new Error("A category with this name already exists");

		const previousOverride = await this.findOverride(input.userId, existing.id);
		const previousDisplayName = mapCategory(existing, previousOverride).name;
		const nameChanged =
			previousDisplayName.toLowerCase() !== name.toLowerCase();
		const nextParent = resolveParentCategoryForUpdate(
			existing,
			input.parentCategory,
		);

		if (isDefaultCategory(existing)) {
			const icon = input.icon ?? null;
			const color =
				input.color !== undefined ? normalizeHexColor(input.color) : undefined;
			await this.upsertOverride(input.userId, existing.id, {
				name: name === existing.name ? null : name,
				icon: icon === (existing.icon ?? null) ? null : icon,
				...(color !== undefined
					? {
							color:
								color === resolveCategoryColor(existing.color) ? null : color,
						}
					: {}),
				...(input.parentCategory !== undefined
					? {
							parentCategory:
								nextParent ===
								((existing.parentCategory as CategoryParent | null) ?? null)
									? null
									: nextParent,
						}
					: {}),
			});
			if (nameChanged) {
				const fromNames = [previousDisplayName];
				if (existing.name.toLowerCase() !== previousDisplayName.toLowerCase()) {
					fromNames.push(existing.name);
				}
				await this.rewriteRuleCategoryNames({
					userId: input.userId,
					fromNames,
					toName: name,
				});
			}
			const override = await this.findOverride(input.userId, existing.id);
			return mapCategory(existing, override);
		}

		if (existing.userId !== input.userId) throw new Error("Category not found");

		const row = (await this.db.category.update({
			where: { id: input.id },
			data: {
				name,
				...(input.icon !== undefined ? { icon: input.icon } : {}),
				...(input.color !== undefined
					? { color: normalizeHexColor(input.color) }
					: {}),
				...(input.parentCategory !== undefined
					? { parentCategory: nextParent }
					: {}),
			},
		})) as CategoryRow;

		if (nameChanged) {
			await this.rewriteRuleCategoryNames({
				userId: input.userId,
				fromNames: [previousDisplayName],
				toName: name,
			});
		}

		return mapCategory(row, null);
	}

	async delete(input: { userId: string; id: string }): Promise<void> {
		const existing = (await this.db.category.findFirst({
			where: {
				id: input.id,
				OR: [{ userId: null }, { userId: input.userId }],
			},
		})) as CategoryRow | null;
		if (!existing) throw new Error("Category not found");

		if (isDefaultCategory(existing)) {
			const capabilities = defaultCategoryCapabilities(existing.name, true);
			if (!capabilities.canDelete) {
				throw new Error("This category cannot be removed");
			}
			await this.upsertOverride(input.userId, existing.id, {
				isHidden: true,
				isRemoved: true,
			});
			return;
		}

		if (existing.userId !== input.userId) throw new Error("Category not found");

		const uncategorized = (await this.db.category.findFirst({
			where: { userId: null, name: "Uncategorized" },
		})) as CategoryRow | null;

		await this.db.$transaction(async (tx) => {
			await tx.transaction.updateMany({
				where: { userId: input.userId, categoryId: input.id },
				data: { categoryId: uncategorized?.id ?? null },
			});
			await tx.categoryBudget.deleteMany({
				where: { userId: input.userId, categoryId: input.id },
			});
			await tx.category.delete({ where: { id: input.id } });
		});
	}

	async toggleHidden(input: {
		userId: string;
		id: string;
		isHidden: boolean;
	}): Promise<CategorySummary> {
		const existing = (await this.db.category.findFirst({
			where: {
				id: input.id,
				OR: [{ userId: null }, { userId: input.userId }],
			},
		})) as CategoryRow | null;
		if (!existing) throw new Error("Category not found");

		if (isDefaultCategory(existing)) {
			const capabilities = defaultCategoryCapabilities(existing.name, true);
			if (!capabilities.canHide && input.isHidden) {
				throw new Error("This category cannot be hidden");
			}
			await this.upsertOverride(input.userId, existing.id, {
				isHidden: input.isHidden ? true : null,
				isRemoved: input.isHidden ? undefined : false,
			});
			const override = await this.findOverride(input.userId, existing.id);
			return mapCategory(existing, override);
		}

		if (existing.userId !== input.userId) throw new Error("Category not found");

		const row = (await this.db.category.update({
			where: { id: input.id },
			data: { isHidden: input.isHidden },
		})) as CategoryRow;

		return mapCategory(row, null);
	}

	async seedDefaults(input: {
		userId: string;
		categories: { name: string; sortOrder: number }[];
	}): Promise<void> {
		for (const cat of input.categories) {
			const color =
				CANONICAL_DEFAULT_CATEGORIES.find(
					(canonical) => canonical.name === cat.name,
				)?.color ?? FALLBACK_CATEGORY_COLOR;
			await this.db.category.upsert({
				where: { id: `default-${cat.name.toLowerCase().replace(/\s+/g, "-")}` },
				create: {
					id: `default-${cat.name.toLowerCase().replace(/\s+/g, "-")}`,
					name: cat.name,
					icon: null,
					color,
					userId: null,
					isHidden: false,
					sortOrder: cat.sortOrder,
				},
				update: { color },
			});
		}
	}
}
