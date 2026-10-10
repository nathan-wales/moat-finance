import {
	type CategoryParent,
	resolveCategoryParent,
} from "@moat/category-mapping";
import { MAX_BUDGET_ALERT_THRESHOLD } from "@moat/contracts";

export const DEFAULT_BUDGET_ALERT_THRESHOLDS = [75, 100] as const;
export const BUDGET_ALERT_EMPTY_THRESHOLD = 100;

export type CategoryBudgetAlerts = {
	enabled: boolean;
	thresholds: number[];
};

export function isFlexibleBudgetCategory(
	parentCategory: string | null | undefined,
): boolean {
	return parentCategory === "FLEXIBLE";
}

export function defaultCategoryBudgetAlertsForParent(
	parentCategory: string | null | undefined,
): CategoryBudgetAlerts {
	return {
		enabled: isFlexibleBudgetCategory(parentCategory),
		thresholds: [...DEFAULT_BUDGET_ALERT_THRESHOLDS],
	};
}

function storedCategoryParent(
	value: string | null | undefined,
): CategoryParent | null | undefined {
	if (value === "FIXED" || value === "FLEXIBLE" || value === "NON_MONTHLY") {
		return value;
	}
	if (value == null) return value;
	return undefined;
}

export function resolveBudgetAlertCreateState(input: {
	categoryName: string;
	storedParent?: string | null;
	alertsEnabled?: boolean;
	alertThresholds?: unknown;
}): { alertsEnabled: boolean; alertThresholds: number[] } {
	const parentCategory = resolveCategoryParent(
		input.categoryName,
		storedCategoryParent(input.storedParent),
	);
	const defaults = defaultCategoryBudgetAlertsForParent(parentCategory);
	return {
		alertsEnabled: input.alertsEnabled ?? defaults.enabled,
		alertThresholds:
			input.alertThresholds === undefined
				? defaults.thresholds
				: normalizeBudgetAlertThresholds(input.alertThresholds),
	};
}

export function normalizeBudgetAlertThresholds(value: unknown): number[] {
	if (!Array.isArray(value)) {
		return [...DEFAULT_BUDGET_ALERT_THRESHOLDS];
	}

	const unique = new Set<number>();
	for (const item of value) {
		const parsed = typeof item === "number" ? item : Number(item);
		if (!Number.isFinite(parsed)) continue;
		const rounded = Math.round(parsed);
		if (rounded < 1 || rounded > MAX_BUDGET_ALERT_THRESHOLD) continue;
		unique.add(rounded);
	}

	const thresholds = [...unique].sort((a, b) => a - b);
	if (thresholds.length === 0) {
		return [...DEFAULT_BUDGET_ALERT_THRESHOLDS];
	}
	return thresholds;
}

export function defaultCategoryBudgetAlerts(): CategoryBudgetAlerts {
	return {
		enabled: true,
		thresholds: [...DEFAULT_BUDGET_ALERT_THRESHOLDS],
	};
}

export function parseCategoryBudgetAlerts(input: {
	alertsEnabled?: boolean | null;
	alertThresholds?: unknown;
	hasSavedBudget: boolean;
}): CategoryBudgetAlerts | null {
	if (!input.hasSavedBudget) return null;
	return {
		enabled: input.alertsEnabled !== false,
		thresholds: normalizeBudgetAlertThresholds(input.alertThresholds),
	};
}

export function formatBudgetAlertThreshold(threshold: number): string {
	return `${threshold}%`;
}

export function formatBudgetAlertSummary(
	alerts: CategoryBudgetAlerts | null,
): string {
	if (!alerts) return "—";
	if (!alerts.enabled) return "Off";
	return alerts.thresholds.map(formatBudgetAlertThreshold).join(" · ");
}

export function budgetAlertPercentUsed(
	spent: number,
	monthlyGoal: number,
): number {
	if (monthlyGoal <= 0) return 0;
	return (spent / monthlyGoal) * 100;
}

export function firedBudgetAlertThresholds(input: {
	spent: number;
	monthlyGoal: number;
	thresholds: number[];
}): number[] {
	if (input.monthlyGoal <= 0) return [];
	const percentUsed = budgetAlertPercentUsed(input.spent, input.monthlyGoal);
	return normalizeBudgetAlertThresholds(input.thresholds).filter(
		(threshold) => percentUsed >= threshold,
	);
}

export function highestFiredBudgetAlertThreshold(input: {
	spent: number;
	monthlyGoal: number;
	thresholds: number[];
}): number | null {
	const fired = firedBudgetAlertThresholds(input);
	return fired.at(-1) ?? null;
}

export function budgetAlertMonthKey(now: Date, timeZone: string): string {
	const zone = timeZone.trim();
	const utcKey = () => {
		const year = now.getUTCFullYear();
		const month = String(now.getUTCMonth() + 1).padStart(2, "0");
		return `${year}-${month}`;
	};
	if (!zone) return utcKey();

	try {
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone: zone,
			year: "numeric",
			month: "2-digit",
		}).formatToParts(now);
		const year = parts.find((part) => part.type === "year")?.value;
		const month = parts.find((part) => part.type === "month")?.value;
		if (year && month) return `${year}-${month}`;
	} catch {
		// Invalid IANA zone — fall back to UTC so evaluation still runs.
	}

	return utcKey();
}

export function budgetAlertEvaluationWindow(
	now: Date,
	categoryId: string,
	timeZone: string,
): string {
	return `budget-alert:${categoryId}:${budgetAlertMonthKey(now, timeZone)}`;
}

export function hasBudgetAlertFiredThisMonth(
	evaluationWindow: string,
	categoryId: string,
	monthKey: string,
): boolean {
	const prefix = `budget-alert:${categoryId}:`;
	if (!evaluationWindow.startsWith(prefix)) return false;
	const rest = evaluationWindow.slice(prefix.length);
	if (rest === monthKey) return true;
	return rest.endsWith(`:${monthKey}`);
}

export function buildBudgetAlertCopy(input: {
	categoryName: string;
	spent: number;
	monthlyGoal: number;
	threshold: number;
	percentOfMonthElapsed?: number;
}): { title: string; body: string; summary: string } {
	const percentUsed = Math.round(
		budgetAlertPercentUsed(input.spent, input.monthlyGoal),
	);
	const isEmpty = input.threshold === BUDGET_ALERT_EMPTY_THRESHOLD;
	if (isEmpty) {
		return {
			title: `${input.categoryName} is over budget`,
			body: `You have spent ${percentUsed}% of this month's ${input.categoryName} budget.`,
			summary: `${input.categoryName} went over its monthly budget.`,
		};
	}

	const monthRemaining = Math.max(
		0,
		100 - Math.round(input.percentOfMonthElapsed ?? 0),
	);
	return {
		title: `${input.categoryName} reached ${input.threshold}% of its budget`,
		body: `You have used ${percentUsed}% with ${monthRemaining}% of the month remaining.`,
		summary: `${input.categoryName} reached ${input.threshold}% of its monthly budget.`,
	};
}
