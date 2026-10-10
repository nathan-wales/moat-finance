import type { BudgetStatus } from "@moat/client-ts";

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
	// Input format: "YYYY-MM"
	const [year, month] = monthStr.split("-");
	const date = new Date(Number(year), Number(month) - 1);
	return date.toLocaleDateString("en-US", { month: "short" });
}

export function formatMonthLabelFull(monthStr: string): string {
	// Input format: "YYYY-MM"
	const [year, month] = monthStr.split("-");
	const date = new Date(Number(year), Number(month) - 1);
	return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
