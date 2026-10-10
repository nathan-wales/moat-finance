import {
	chartBarTooltipCursor,
	chartLineTooltipCursor,
	resolveChartDataKey,
	resolveChartIndex,
	useChartActiveIndex,
} from "@moat/charts";
import {
	endOfMonth,
	endOfWeek,
	format,
	startOfMonth,
	startOfWeek,
} from "date-fns";

export {
	chartBarTooltipCursor,
	chartLineTooltipCursor,
	resolveChartDataKey,
	resolveChartIndex,
	useChartActiveIndex,
};

export function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatSignedCurrency(value: number): string {
	const formatted = formatCurrency(Math.abs(value));
	if (value > 0) return `+${formatted}`;
	if (value < 0) return `-${formatted}`;
	return formatted;
}

export function formatPercent(value: number | null): string {
	if (value === null) return "—";
	return `${Math.round(value * 100)}%`;
}

export function formatChartLabel(date: string): string {
	if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		const parsed = new Date(`${date}T00:00:00`);
		return parsed.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	}

	if (/^\d{4}-\d{2}$/.test(date)) {
		const [yearPart, secondPart] = date.split("-");
		const year = Number(yearPart);
		const second = Number(secondPart);
		if (second > 12) {
			return `Week ${second}, '${String(year).slice(-2)}`;
		}

		const parsed = new Date(year, second - 1, 1);
		return parsed.toLocaleDateString("en-US", {
			month: "short",
			year: "2-digit",
		});
	}

	return date;
}

export function chartBucketToDateRange(dateKey: string): {
	from: string;
	to: string;
} {
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
		const parsed = new Date(`${dateKey}T00:00:00`);
		return {
			from: format(startOfWeek(parsed, { weekStartsOn: 1 }), "yyyy-MM-dd"),
			to: format(endOfWeek(parsed, { weekStartsOn: 1 }), "yyyy-MM-dd"),
		};
	}

	if (/^\d{4}-\d{2}$/.test(dateKey)) {
		const [yearPart, monthPart] = dateKey.split("-");
		const year = Number(yearPart);
		const month = Number(monthPart);
		const parsed = new Date(year, month - 1, 1);
		return {
			from: format(startOfMonth(parsed), "yyyy-MM-dd"),
			to: format(endOfMonth(parsed), "yyyy-MM-dd"),
		};
	}

	return { from: dateKey, to: dateKey };
}

export const INSIGHTS_CHART_PALETTE = [
	"#3b82f6",
	"#10b981",
	"#f59e0b",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
	"#f97316",
	"#84cc16",
];
