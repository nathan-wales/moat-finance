import { resolveCategoryParent } from "@moat/category-mapping";
import type { CategoryParent } from "@moat/contracts";
import { resolveCategoryColor } from "@moat/contracts";

export const UNCATEGORIZED_CATEGORY_NAME = "Uncategorized";
export const TRANSFER_CATEGORY_NAME = "Transfer";

export type CategoryOverrideFields = {
	name?: string | null;
	icon?: string | null;
	color?: string | null;
	isHidden?: boolean | null;
	isRemoved?: boolean | null;
	parentCategory?: CategoryParent | null;
};

export type ResolvedCategoryPresentation = {
	name: string;
	icon: string | null;
	color: string;
	isHidden: boolean;
	isRemoved: boolean;
	canDelete: boolean;
	canHide: boolean;
	parentCategory: CategoryParent | null;
};

export function defaultCategoryCapabilities(
	canonicalName: string,
	isDefault: boolean,
): { canDelete: boolean; canHide: boolean } {
	if (!isDefault) {
		return { canDelete: true, canHide: true };
	}
	const isUncategorized = canonicalName === UNCATEGORIZED_CATEGORY_NAME;
	const isTransfer = canonicalName === TRANSFER_CATEGORY_NAME;
	return {
		canDelete: !isUncategorized && !isTransfer,
		canHide: !isUncategorized,
	};
}

export function applyCategoryOverride(
	category: {
		name: string;
		icon: string | null;
		color?: string | null;
		isHidden: boolean;
		isDefault: boolean;
		parentCategory?: CategoryParent | null;
	},
	override?: CategoryOverrideFields | null,
): ResolvedCategoryPresentation {
	const isRemoved = Boolean(override?.isRemoved);
	const capabilities = defaultCategoryCapabilities(
		category.name,
		category.isDefault,
	);
	return {
		name: override?.name ?? category.name,
		icon: override?.icon ?? category.icon,
		color: resolveCategoryColor(override?.color ?? category.color),
		isHidden: isRemoved || (override?.isHidden ?? category.isHidden),
		isRemoved,
		canDelete: capabilities.canDelete,
		canHide: capabilities.canHide,
		parentCategory: resolveCategoryParent(
			category.name,
			override?.parentCategory ?? category.parentCategory,
		),
	};
}

export function isEmptyCategoryOverride(
	override: CategoryOverrideFields,
): boolean {
	return (
		override.name == null &&
		override.icon == null &&
		override.color == null &&
		override.isHidden == null &&
		!override.isRemoved &&
		override.parentCategory == null
	);
}

/** Postgres: exclude txs whose resolved category is hidden or removed. */
export const POSTGRES_HIDDEN_CATEGORY_EXCLUSION_SQL = `NOT EXISTS (
	SELECT 1 FROM "Category" hc
	LEFT JOIN "CategoryOverride" ho
		ON ho."categoryId" = hc.id AND ho."userId" = t."userId"
	WHERE hc.id = t."categoryId"
		AND (
			COALESCE(ho."isRemoved", false) = true
			OR COALESCE(ho."isHidden", hc."isHidden") = true
		)
)`;

export const POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL = `LEFT JOIN "CategoryOverride" o ON o."categoryId" = c.id AND o."userId" = t."userId"`;

export const POSTGRES_RESOLVED_CATEGORY_NAME_SQL = `COALESCE(o.name, c.name)`;

/** SQLite: same exclusion, 0/1 booleans, unquoted identifiers matching existing repos. */
export const SQLITE_HIDDEN_CATEGORY_EXCLUSION_SQL = `NOT EXISTS (
	SELECT 1 FROM Category hc
	LEFT JOIN CategoryOverride ho
		ON ho.categoryId = hc.id AND ho.userId = t.userId
	WHERE hc.id = t.categoryId
		AND (
			COALESCE(ho.isRemoved, 0) = 1
			OR COALESCE(ho.isHidden, hc.isHidden) = 1
		)
)`;

export const SQLITE_CATEGORY_OVERRIDE_JOIN_SQL = `LEFT JOIN CategoryOverride o ON o.categoryId = c.id AND o.userId = t.userId`;

export const SQLITE_RESOLVED_CATEGORY_NAME_SQL = `COALESCE(o.name, c.name)`;

/** Desktop transactions resolve category through categoryId. There is no category string column. */
export const SQLITE_RESOLVED_CATEGORY_NAME_EXPR = `LOWER(COALESCE(
	(
		SELECT COALESCE(o2.name, c2.name)
		FROM Category c2
		LEFT JOIN CategoryOverride o2
			ON o2.categoryId = c2.id AND o2.userId = t.userId
		WHERE c2.id = t.categoryId
	),
	'Uncategorized'
))`;

export function sqliteCategoryNamesFilter(names: string[] | undefined): {
	sql: string;
	params: string[];
} {
	if (names === undefined) return { sql: "", params: [] };
	const normalized = [
		...new Set(
			names
				.map((name) => name.trim().toLowerCase())
				.filter((name) => name.length > 0),
		),
	];
	if (normalized.length === 0) return { sql: "AND 0", params: [] };
	return {
		sql: `AND ${SQLITE_RESOLVED_CATEGORY_NAME_EXPR} IN (${normalized.map(() => "?").join(", ")})`,
		params: normalized,
	};
}
