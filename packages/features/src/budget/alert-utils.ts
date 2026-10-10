import type { CategoryBudgetAlerts } from "@moat/contracts";

export const DEFAULT_BUDGET_ALERT_THRESHOLDS = [75, 100];

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

export function isFlexibleBudgetCategory(
	parentCategory: string | null | undefined,
): boolean {
	return parentCategory === "FLEXIBLE";
}

export function defaultBudgetAlerts(): CategoryBudgetAlerts {
	return {
		enabled: true,
		thresholds: [...DEFAULT_BUDGET_ALERT_THRESHOLDS],
	};
}

export function defaultBudgetAlertsForParent(
	parentCategory: string | null | undefined,
): CategoryBudgetAlerts {
	return {
		enabled: isFlexibleBudgetCategory(parentCategory),
		thresholds: [...DEFAULT_BUDGET_ALERT_THRESHOLDS],
	};
}
