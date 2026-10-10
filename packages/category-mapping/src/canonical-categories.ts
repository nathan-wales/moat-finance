/**
 * Canonical Moat default categories — single source of truth for Postgres seed
 * and desktop SQLite seed. Provider mappers (Plaid PFC, Apple MCC) emit these names.
 */
export const CATEGORY_PARENTS = ["FIXED", "FLEXIBLE", "NON_MONTHLY"] as const;

export type CategoryParent = (typeof CATEGORY_PARENTS)[number];

export const UNGROUPED_CANONICAL_CATEGORY_NAMES = [
	"Salary",
	"Reimbursement",
	"Transfer",
	"Credit card payment",
	"Investments",
] as const;

const UNGROUPED_CANONICAL_CATEGORY_NAME_SET = new Set<string>(
	UNGROUPED_CANONICAL_CATEGORY_NAMES,
);

export function isUngroupedCanonicalCategory(name: string): boolean {
	return UNGROUPED_CANONICAL_CATEGORY_NAME_SET.has(name);
}

export type CanonicalCategory = {
	name: string;
	sortOrder: number;
	color: string;
	isHidden?: boolean;
	parentCategory?: CategoryParent | null;
};

export const CANONICAL_DEFAULT_CATEGORIES: readonly CanonicalCategory[] = [
	{ name: "Salary", sortOrder: 0, color: "#16A34A" },
	{ name: "Reimbursement", sortOrder: 1, color: "#22C55E" },
	{
		name: "Eating Out",
		sortOrder: 10,
		color: "#EA580C",
		parentCategory: "FLEXIBLE",
	},
	{
		name: "Groceries",
		sortOrder: 11,
		color: "#D97706",
		parentCategory: "FLEXIBLE",
	},
	{
		name: "Mortgage & Rent",
		sortOrder: 20,
		color: "#2563EB",
		parentCategory: "FIXED",
	},
	{
		name: "Home",
		sortOrder: 21,
		color: "#3B82F6",
		parentCategory: "NON_MONTHLY",
	},
	{
		name: "Bills & Utilities",
		sortOrder: 22,
		color: "#0EA5E9",
		parentCategory: "FIXED",
	},
	{
		name: "Insurance",
		sortOrder: 23,
		color: "#0F766E",
		parentCategory: "FIXED",
	},
	{
		name: "Auto & Transport",
		sortOrder: 30,
		color: "#475569",
		parentCategory: "FLEXIBLE",
	},
	{ name: "Gas", sortOrder: 31, color: "#64748B", parentCategory: "FLEXIBLE" },
	{
		name: "Cars",
		sortOrder: 32,
		color: "#78716C",
		parentCategory: "NON_MONTHLY",
	},
	{
		name: "Travel",
		sortOrder: 40,
		color: "#DB2777",
		parentCategory: "NON_MONTHLY",
	},
	{
		name: "Flights",
		sortOrder: 41,
		color: "#EC4899",
		parentCategory: "NON_MONTHLY",
	},
	{
		name: "Shopping",
		sortOrder: 50,
		color: "#9333EA",
		parentCategory: "FLEXIBLE",
	},
	{
		name: "Clothing",
		sortOrder: 51,
		color: "#C026D3",
		parentCategory: "FLEXIBLE",
	},
	{
		name: "Entertainment",
		sortOrder: 60,
		color: "#E11D48",
		parentCategory: "FLEXIBLE",
	},
	{
		name: "Sports & Fitness",
		sortOrder: 61,
		color: "#65A30D",
		parentCategory: "FLEXIBLE",
	},
	{
		name: "Subscriptions",
		sortOrder: 62,
		color: "#BE185D",
		parentCategory: "FIXED",
	},
	{
		name: "Health & Medical",
		sortOrder: 70,
		color: "#0891B2",
		parentCategory: "FLEXIBLE",
	},
	{ name: "Kids", sortOrder: 80, color: "#7C3AED", parentCategory: "FLEXIBLE" },
	{ name: "Pets", sortOrder: 82, color: "#B45309", parentCategory: "FLEXIBLE" },
	{
		name: "Education",
		sortOrder: 85,
		color: "#4F46E5",
		parentCategory: "FLEXIBLE",
	},
	{
		name: "Gifts & Donations",
		sortOrder: 90,
		color: "#CA8A04",
		parentCategory: "NON_MONTHLY",
	},
	{
		name: "Business Services",
		sortOrder: 100,
		color: "#6366F1",
		parentCategory: "FLEXIBLE",
	},
	{ name: "Investments", sortOrder: 110, color: "#15803D" },
	{ name: "Loans", sortOrder: 120, color: "#B91C1C", parentCategory: "FIXED" },
	{
		name: "Taxes",
		sortOrder: 130,
		color: "#0D9488",
		parentCategory: "NON_MONTHLY",
	},
	{
		name: "Fees",
		sortOrder: 140,
		color: "#DC2626",
		parentCategory: "FLEXIBLE",
	},
	{ name: "Credit card payment", sortOrder: 150, color: "#57534E" },
	{ name: "Transfer", sortOrder: 998, color: "#737373", isHidden: true },
	{
		name: "Uncategorized",
		sortOrder: 999,
		color: "#94A3B8",
		parentCategory: "FLEXIBLE",
	},
] as const;

/** Legacy desktop seed names → canonical names (1:1 renames). */
export const LEGACY_DESKTOP_CATEGORY_RENAMES: ReadonlyArray<{
	from: string;
	to: string;
}> = [
	{ from: "Dining Out", to: "Eating Out" },
	{ from: "Income", to: "Salary" },
	{ from: "Utilities", to: "Bills & Utilities" },
	{ from: "Healthcare", to: "Health & Medical" },
	{ from: "Transportation", to: "Auto & Transport" },
	{ from: "Transfers", to: "Transfer" },
	{ from: "Fees & Charges", to: "Fees" },
];

export function canonicalCategoryId(name: string): string {
	return `default-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

const DEFAULT_CUSTOM_CATEGORY_PARENT: CategoryParent = "FLEXIBLE";

const PARENT_BY_CANONICAL_NAME = new Map<string, CategoryParent | null>(
	CANONICAL_DEFAULT_CATEGORIES.map((category) => [
		category.name,
		category.parentCategory ?? null,
	]),
);

for (const rename of LEGACY_DESKTOP_CATEGORY_RENAMES) {
	const parent = PARENT_BY_CANONICAL_NAME.get(rename.to);
	if (parent === undefined) continue;
	PARENT_BY_CANONICAL_NAME.set(rename.from, parent);
}

/**
 * Resolves the spend parent for a category. Stored values win; otherwise the
 * canonical catalog is used; unknown custom names default to Flexible.
 * Income, transfer, and investment catalog names stay ungrouped (`null`).
 */
export function resolveCategoryParent(
	name: string,
	stored?: CategoryParent | null,
): CategoryParent | null {
	if (stored) return stored;
	if (PARENT_BY_CANONICAL_NAME.has(name)) {
		return PARENT_BY_CANONICAL_NAME.get(name) ?? null;
	}
	return DEFAULT_CUSTOM_CATEGORY_PARENT;
}
