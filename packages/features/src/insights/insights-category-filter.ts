import type { Category } from "@moat/contracts";

export const INSIGHTS_CATEGORY_FILTER_STORAGE_KEY =
	"insights-category-filter-exclusions";

export type InsightsCategoryFilterExclusions = {
	income: string[];
	expense: string[];
};

export type InsightsCategoryQueryFilter = {
	incomeCategories?: string[];
	expenseCategories?: string[];
};

export type InsightsCategoryActivity = {
	income: string[];
	expense: string[];
};

export type InsightsCategoryNameGroups = {
	income: string[];
	expense: string[];
};

export const EMPTY_INSIGHTS_CATEGORY_FILTER_EXCLUSIONS: InsightsCategoryFilterExclusions =
	{
		income: [],
		expense: [],
	};

export function isInsightsPickerCategory(
	category: Pick<Category, "isHidden" | "isRemoved">,
): boolean {
	return !category.isHidden && !category.isRemoved;
}

export function isInsightsIncomeCategory(
	category: Pick<Category, "parentCategory">,
): boolean {
	return category.parentCategory === null;
}

export function splitInsightsFilterCategories(
	categories: Category[],
): InsightsCategoryNameGroups {
	const visible = categories.filter(isInsightsPickerCategory);
	return {
		income: uniqueSortedNames(
			visible.filter(isInsightsIncomeCategory).map((category) => category.name),
		),
		expense: uniqueSortedNames(
			visible
				.filter((category) => !isInsightsIncomeCategory(category))
				.map((category) => category.name),
		),
	};
}

export function mergeInsightsFilterCategories(
	catalog: InsightsCategoryNameGroups,
	activity: InsightsCategoryActivity,
): InsightsCategoryNameGroups {
	return {
		income: uniqueSortedNames([...catalog.income, ...activity.income]),
		expense: uniqueSortedNames([...catalog.expense, ...activity.expense]),
	};
}

export function retainInsightsCategoryExclusions(
	previous: InsightsCategoryFilterExclusions,
	next: InsightsCategoryFilterExclusions,
	available: InsightsCategoryNameGroups,
): InsightsCategoryFilterExclusions {
	const incomeAvailable = new Set(
		available.income.map((name) => name.toLowerCase()),
	);
	const expenseAvailable = new Set(
		available.expense.map((name) => name.toLowerCase()),
	);
	return {
		income: uniqueSortedNames([
			...next.income,
			...previous.income.filter(
				(name) => !incomeAvailable.has(name.trim().toLowerCase()),
			),
		]),
		expense: uniqueSortedNames([
			...next.expense,
			...previous.expense.filter(
				(name) => !expenseAvailable.has(name.trim().toLowerCase()),
			),
		]),
	};
}

function uniqueSortedNames(names: string[]): string[] {
	const byKey = new Map<string, string>();
	for (const name of names) {
		const trimmed = name.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (!byKey.has(key)) byKey.set(key, trimmed);
	}
	return [...byKey.values()].sort((left, right) => left.localeCompare(right));
}

function uniqueNames(names: unknown): string[] {
	if (!Array.isArray(names)) return [];
	return uniqueSortedNames(
		names.filter(
			(name): name is string =>
				typeof name === "string" && name.trim().length > 0,
		),
	);
}

export function parseInsightsCategoryFilterExclusions(
	raw: string | null,
): InsightsCategoryFilterExclusions {
	if (!raw) return { ...EMPTY_INSIGHTS_CATEGORY_FILTER_EXCLUSIONS };

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") {
			return { ...EMPTY_INSIGHTS_CATEGORY_FILTER_EXCLUSIONS };
		}

		const record = parsed as {
			income?: unknown;
			expense?: unknown;
		};
		return {
			income: uniqueNames(record.income),
			expense: uniqueNames(record.expense),
		};
	} catch {
		return { ...EMPTY_INSIGHTS_CATEGORY_FILTER_EXCLUSIONS };
	}
}

export function sanitizeInsightsCategoryFilterExclusions(
	exclusions: InsightsCategoryFilterExclusions,
	available: InsightsCategoryNameGroups,
): InsightsCategoryFilterExclusions {
	return {
		income: matchAvailableNames(exclusions.income, available.income),
		expense: matchAvailableNames(exclusions.expense, available.expense),
	};
}

function matchAvailableNames(
	excluded: string[],
	available: string[],
): string[] {
	const byKey = new Map(
		available.map((name) => [name.toLowerCase(), name] as const),
	);
	return uniqueSortedNames(
		excluded.flatMap((name) => {
			const match = byKey.get(name.trim().toLowerCase());
			return match ? [match] : [];
		}),
	);
}

export function selectedInsightsCategoryNames(
	all: string[],
	excluded: string[],
): string[] {
	const excludedSet = new Set(excluded);
	return all.filter((name) => !excludedSet.has(name));
}

export function unselectedInsightsCategoryNames(
	all: string[],
	selected: string[],
): string[] {
	const selectedSet = new Set(selected);
	return all.filter((name) => !selectedSet.has(name));
}

export function toInsightsCategoryQueryFilter(
	all: string[],
	excluded: string[],
): string[] | undefined {
	if (excluded.length === 0) return undefined;
	return selectedInsightsCategoryNames(all, excluded);
}

export function insightsCategoryFilterIsActive(
	exclusions: InsightsCategoryFilterExclusions,
): boolean {
	return exclusions.income.length > 0 || exclusions.expense.length > 0;
}

export function insightsCategoryQueryKeySuffix(
	input: InsightsCategoryQueryFilter,
): string {
	if (
		input.incomeCategories === undefined &&
		input.expenseCategories === undefined
	) {
		return "all";
	}

	return JSON.stringify({
		income: input.incomeCategories ?? null,
		expense: input.expenseCategories ?? null,
	});
}
