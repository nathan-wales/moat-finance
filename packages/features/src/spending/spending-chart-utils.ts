import type { SpendingTrendMonth } from "@moat/contracts";

export const SPENDING_CHART_PALETTE = [
	"#3b82f6",
	"#f59e0b",
	"#10b981",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
	"#f97316",
	"#84cc16",
	"#ef4444",
	"#6366f1",
	"#94a3b8",
];

export type CategoryTrendRow = {
	amount: number;
	category: string;
	color: string;
};

export type RankedSpendingTrendMonth = SpendingTrendMonth & {
	trendRows?: CategoryTrendRow[];
};

export function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

export function getCategoryColor(index: number): string {
	return (
		SPENDING_CHART_PALETTE[index % SPENDING_CHART_PALETTE.length] ?? "#94a3b8"
	);
}

export function getTrendSegmentAmountKey(index: number): string {
	return `trendSegment${index}Amount`;
}

export function getTrendSegmentColorKey(index: number): string {
	return `trendSegment${index}Color`;
}

function toTrendAmount(value: unknown): number {
	const amount = Number(value);
	return Number.isFinite(amount) ? amount : 0;
}

function getSortedTrendRows(
	month: SpendingTrendMonth,
	categories: string[],
): CategoryTrendRow[] {
	return categories
		.map((category, index) => ({
			amount: toTrendAmount(month[category]),
			category,
			color: getCategoryColor(index),
		}))
		.filter((row) => row.amount > 0)
		.sort((a, b) => b.amount - a.amount);
}

export function buildRankedTrendData(
	months: SpendingTrendMonth[],
	categories: string[],
): RankedSpendingTrendMonth[] {
	return months.map((month) => {
		const trendRows = getSortedTrendRows(month, categories);
		const rankedMonth: RankedSpendingTrendMonth = {
			...month,
			trendRows,
		};

		categories.forEach((_, index) => {
			const segment = trendRows[index];
			rankedMonth[getTrendSegmentAmountKey(index)] = segment?.amount ?? 0;
			rankedMonth[getTrendSegmentColorKey(index)] =
				segment?.color ?? "transparent";
		});

		return rankedMonth;
	});
}
