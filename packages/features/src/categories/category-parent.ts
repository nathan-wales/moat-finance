import { resolveCategoryParent } from "@moat/category-mapping";
import {
	CATEGORY_PARENT_LABELS,
	CATEGORY_PARENTS,
	type CategoryParent,
	type CategoryViewMode,
} from "@moat/contracts";

export const CATEGORY_VIEW_STORAGE_KEYS = {
	insightsNetIncome: "insights-net-income-category-view",
	insightsSpending: "insights-spending-category-view",
	categoriesList: "categories-list-view",
	budget: "budget-category-view",
} as const;

export type SpendRow = {
	category: string;
	amount: number;
	parentCategory: CategoryParent | null;
	monthlyAvg?: number;
};

export type ParentSpendRow = {
	parent: CategoryParent;
	label: string;
	amount: number;
	monthlyAvg: number;
	categories: string[];
	percentage: number;
	percentOfTop: number;
};

export function parentCategoryLabel(
	parent: CategoryParent | null | undefined,
): string | null {
	if (!parent) return null;
	return CATEGORY_PARENT_LABELS[parent];
}

export function canEditCategoryParent(category: {
	isDefault: boolean;
	parentCategory: CategoryParent | null;
}): boolean {
	return !category.isDefault || category.parentCategory !== null;
}

export function rollupSpendByParent(rows: SpendRow[]): ParentSpendRow[] {
	const groups = new Map<
		CategoryParent,
		{ amount: number; monthlyAvg: number; categories: string[] }
	>();
	for (const parent of CATEGORY_PARENTS) {
		groups.set(parent, { amount: 0, monthlyAvg: 0, categories: [] });
	}

	for (const row of rows) {
		const parent = resolveCategoryParent(row.category, row.parentCategory);
		if (!parent) continue;
		const group = groups.get(parent);
		if (!group) continue;
		group.amount += row.amount;
		group.monthlyAvg += row.monthlyAvg ?? 0;
		group.categories.push(row.category);
	}

	const rolled = CATEGORY_PARENTS.map((parent) => {
		const group = groups.get(parent) ?? {
			amount: 0,
			monthlyAvg: 0,
			categories: [],
		};
		return {
			parent,
			label: CATEGORY_PARENT_LABELS[parent],
			amount: group.amount,
			monthlyAvg: group.monthlyAvg,
			categories: group.categories,
		};
	});

	const total = rolled.reduce((sum, row) => sum + row.amount, 0);
	const top = Math.max(...rolled.map((row) => row.amount), 0);

	return rolled.map((row) => ({
		...row,
		percentage: total > 0 ? (row.amount / total) * 100 : 0,
		percentOfTop: top > 0 ? (row.amount / top) * 100 : 0,
	}));
}

export function isCategoryViewMode(
	value: string | null,
): value is CategoryViewMode {
	return value === "category" || value === "parent";
}
