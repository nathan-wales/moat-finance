import type { BudgetStatus } from "./getBudgetStatus";

export function computeBudgetStatus(
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

export function computeStatusMessage(
	status: BudgetStatus,
	spent: number,
	totalBudget: number,
	isCurrentMonth = true,
): string {
	const remaining = totalBudget - spent;
	const formattedRemaining = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(Math.abs(remaining));

	switch (status) {
		case "overspending":
			return `You have exceeded your budget by ${formattedRemaining}.`;
		case "close-to-budget":
			return `You have ${formattedRemaining} remaining in your budget.`;
		case "on-track":
			return `You have ${formattedRemaining} remaining in your budget.`;
		case "no-spend":
			return isCurrentMonth
				? "No spending recorded yet this month."
				: "No spending recorded this month.";
		case "unknown":
			return "Budget status unavailable.";
	}
}

export function roundToFriendlyNumber(value: number): number {
	if (value <= 0) return 0;
	if (value < 100) return Math.round(value / 10) * 10;
	return Math.round(value / 25) * 25;
}
