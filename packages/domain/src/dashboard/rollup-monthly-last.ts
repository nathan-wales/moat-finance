import { format } from "date-fns";

export type MonthlyValuePoint = {
	month: string;
	total: number;
};

export function rollupLastPerMonth(
	rows: Array<{ date: string; value: number }>,
): MonthlyValuePoint[] {
	const monthMap = new Map<string, number>();
	const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
	for (const row of sorted) {
		const month = row.date.slice(0, 7);
		monthMap.set(month, row.value);
	}
	return Array.from(monthMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, total]) => ({ month, total }));
}

export function ensureCurrentMonthPoint(
	points: MonthlyValuePoint[],
	current: number,
	now: Date = new Date(),
): MonthlyValuePoint[] {
	const currentMonth = format(now, "yyyy-MM");
	return [
		...points.filter((point) => point.month !== currentMonth),
		{ month: currentMonth, total: current },
	];
}

export function toMonthlyAssetHistory(
	rows: Array<{ date: string; value: number }>,
	current: number,
	months: number,
	now: Date = new Date(),
): { current: number; points: MonthlyValuePoint[] } {
	const start = new Date(now);
	start.setMonth(start.getMonth() - months);
	start.setHours(0, 0, 0, 0);
	const startDate = format(start, "yyyy-MM-dd");
	const rolled = rollupLastPerMonth(
		rows.filter((row) => row.date >= startDate),
	);
	return {
		current,
		points: ensureCurrentMonthPoint(rolled, current, now),
	};
}

export type AssetHistorySource = "PLAID" | "INVESTMENT" | "REAL_ESTATE";

export function resolveInvestmentCardSource(id: string): {
	source: Extract<AssetHistorySource, "PLAID" | "INVESTMENT">;
	sourceId: string;
} {
	if (id.startsWith("plaid_")) {
		return { source: "PLAID", sourceId: id.slice("plaid_".length) };
	}
	if (id.startsWith("plaid-")) {
		return { source: "PLAID", sourceId: id.slice("plaid-".length) };
	}
	return { source: "INVESTMENT", sourceId: id };
}

export function toAccountHistoryId(
	source: Extract<AssetHistorySource, "PLAID" | "INVESTMENT">,
	sourceId: string,
): string {
	if (source === "PLAID") return `plaid-${sourceId}`;
	return `investment-acct-${sourceId}`;
}
