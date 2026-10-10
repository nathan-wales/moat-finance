import { resolveCategoryParent } from "@moat/category-mapping";
import {
	type BudgetStatus,
	CATEGORY_PARENT_LABELS,
	CATEGORY_PARENTS,
	type CategoryParent,
} from "@moat/contracts";

// ─── Status Display Helpers ───────────────────────────────────────────────────

export function getStatusColor(status: BudgetStatus): string {
	switch (status) {
		case "overspending":
			return "text-red-600";
		case "close-to-budget":
			return "text-amber-600";
		case "on-track":
			return "text-green-600";
		case "no-spend":
			return "text-muted-foreground";
		case "unknown":
			return "text-muted-foreground";
		default:
			return "text-muted-foreground";
	}
}

export function getStatusBgColor(status: BudgetStatus): string {
	switch (status) {
		case "overspending":
			return "bg-red-100";
		case "close-to-budget":
			return "bg-amber-100";
		case "on-track":
			return "bg-green-100";
		case "no-spend":
			return "bg-muted";
		case "unknown":
			return "bg-muted";
		default:
			return "bg-muted";
	}
}

export function getStatusLabel(status: BudgetStatus): string {
	switch (status) {
		case "overspending":
			return "Overspending";
		case "close-to-budget":
			return "Close to Budget";
		case "on-track":
			return "On Track";
		case "no-spend":
			return "No Spend";
		case "unknown":
			return "Unknown";
		default:
			return "Unknown";
	}
}

export function getProgressBarColor(status: BudgetStatus): string {
	switch (status) {
		case "overspending":
			return "bg-red-500";
		case "close-to-budget":
			return "bg-amber-500";
		case "on-track":
			return "bg-green-500";
		case "no-spend":
			return "bg-muted-foreground";
		case "unknown":
			return "bg-muted-foreground";
		default:
			return "bg-muted-foreground";
	}
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatCompactCurrency(value: number): string {
	if (value >= 1000) {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			notation: "compact",
			minimumFractionDigits: 0,
			maximumFractionDigits: 1,
		}).format(value);
	}
	return formatCurrency(value);
}

export function formatMonthLabel(monthStr: string): string {
	const [year, month] = monthStr.split("-");
	const date = new Date(Number(year), Number(month) - 1);
	return date.toLocaleDateString("en-US", { month: "short" });
}

export function formatMonthLabelFull(monthStr: string): string {
	const [year, month] = monthStr.split("-");
	const date = new Date(Number(year), Number(month) - 1);
	return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function parseMonthKey(monthStr: string): Date | null {
	const [yearPart, monthPart] = monthStr.split("-");
	const year = Number(yearPart);
	const monthNumber = Number(monthPart);
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(monthNumber) ||
		monthNumber < 1 ||
		monthNumber > 12
	) {
		return null;
	}
	return new Date(year, monthNumber - 1, 1);
}

export function getBudgetOverviewTitle(
	selectedMonth: string,
	currentMonth: string,
): string {
	if (selectedMonth === currentMonth) return "This Month Overview";
	const date = parseMonthKey(selectedMonth);
	if (!date) return "This Month Overview";
	return `${date.toLocaleDateString("en-US", { month: "long" })}'s Overview`;
}

export function computeBudgetRowStatus(
	spent: number,
	totalBudget: number,
	hasGoal: boolean,
): BudgetStatus {
	if (spent === 0) return "no-spend";
	if (!hasGoal) return "unknown";
	const ratio = spent / totalBudget;
	if (ratio <= 0.8) return "on-track";
	if (ratio <= 1.0) return "close-to-budget";
	return "overspending";
}

export type BudgetParentRow = {
	parent: CategoryParent;
	label: string;
	spentThisMonth: number;
	monthlyGoal: number | null;
	expectedSpendToDate: number;
	status: BudgetStatus;
	categories: string[];
};

export function rollupBudgetByParent(
	rows: Array<{
		categoryName: string;
		spentThisMonth: number;
		monthlyGoal: number | null;
		expectedSpendToDate: number;
		parentCategory: CategoryParent | null;
	}>,
): BudgetParentRow[] {
	const groups = new Map<
		CategoryParent,
		{
			spent: number;
			goalSum: number;
			hasGoal: boolean;
			expected: number;
			categories: string[];
		}
	>();
	for (const parent of CATEGORY_PARENTS) {
		groups.set(parent, {
			spent: 0,
			goalSum: 0,
			hasGoal: false,
			expected: 0,
			categories: [],
		});
	}

	for (const row of rows) {
		const parent = resolveCategoryParent(row.categoryName, row.parentCategory);
		if (!parent) continue;
		const group = groups.get(parent);
		if (!group) continue;
		group.spent += row.spentThisMonth;
		group.expected += row.expectedSpendToDate;
		if (row.monthlyGoal != null) {
			group.hasGoal = true;
			group.goalSum += row.monthlyGoal;
		}
		group.categories.push(row.categoryName);
	}

	return CATEGORY_PARENTS.map((parent) => {
		const group = groups.get(parent) ?? {
			spent: 0,
			goalSum: 0,
			hasGoal: false,
			expected: 0,
			categories: [],
		};
		const monthlyGoal = group.hasGoal ? group.goalSum : null;
		return {
			parent,
			label: CATEGORY_PARENT_LABELS[parent],
			spentThisMonth: group.spent,
			monthlyGoal,
			expectedSpendToDate: group.expected,
			status: computeBudgetRowStatus(
				group.spent,
				monthlyGoal ?? 0,
				monthlyGoal !== null,
			),
			categories: group.categories,
		};
	});
}

export function groupCategoriesByParent<
	T extends { categoryName: string; parentCategory: CategoryParent | null },
>(categories: T[]): Record<CategoryParent, T[]> {
	const grouped: Record<CategoryParent, T[]> = {
		FIXED: [],
		FLEXIBLE: [],
		NON_MONTHLY: [],
	};

	for (const category of categories) {
		const parent = resolveCategoryParent(
			category.categoryName,
			category.parentCategory,
		);
		if (!parent) continue;
		grouped[parent].push(category);
	}

	for (const parent of CATEGORY_PARENTS) {
		grouped[parent].sort((a, b) =>
			a.categoryName.localeCompare(b.categoryName),
		);
	}

	return grouped;
}
