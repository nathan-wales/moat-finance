import type {
	InsightsInput,
	InsightsPeriod,
	SpendingInput,
} from "@moat/contracts";
import type { DateRange } from "@moat/ui";
import {
	differenceInCalendarMonths,
	endOfMonth,
	endOfWeek,
	format,
	isValid,
	startOfMonth,
	startOfWeek,
	subMonths,
	subWeeks,
} from "date-fns";

const INSIGHTS_WEEK_STARTS_ON = 1 as const;

export const INSIGHTS_PERIOD_OPTIONS: Array<{
	value: InsightsPeriod;
	label: string;
}> = [
	{ value: "this-week", label: "This week" },
	{ value: "last-week", label: "Last week" },
	{ value: "this-month", label: "This month" },
	{ value: "last-month", label: "Last month" },
	{ value: "1m", label: "1M" },
	{ value: "2m", label: "2M" },
	{ value: "3m", label: "3M" },
	{ value: "6m", label: "6M" },
	{ value: "12m", label: "12M" },
	{ value: "custom", label: "Custom" },
];

export const DEFAULT_INSIGHTS_PERIOD: InsightsPeriod = "this-month";
export const DEFAULT_INSIGHTS_TAB = "net-income";

export type InsightsPeriodSelection = {
	period: InsightsPeriod;
	customDateRange?: DateRange;
};

export type AppliedInsightsDateRange = {
	from: Date;
	to: Date;
};

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(dateStr: string) {
	const [year = 0, month = 0, day = 0] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day);
}

export function parseInsightsCustomDateRange(
	fromParam: string | null,
	toParam: string | null,
): DateRange | undefined {
	if (!fromParam || !toParam) {
		return undefined;
	}

	if (
		!DATE_PARAM_PATTERN.test(fromParam) ||
		!DATE_PARAM_PATTERN.test(toParam)
	) {
		return undefined;
	}

	const from = parseDateParam(fromParam);
	const to = parseDateParam(toParam);
	if (!isValid(from) || !isValid(to) || from >= to) {
		return undefined;
	}

	return {
		from,
		to,
	};
}

export function getAppliedInsightsDateRange(
	customDateRange: DateRange | undefined,
): AppliedInsightsDateRange | undefined {
	if (
		customDateRange?.from &&
		customDateRange?.to &&
		isValid(customDateRange.from) &&
		isValid(customDateRange.to) &&
		customDateRange.from.getTime() !== customDateRange.to.getTime()
	) {
		return {
			from: customDateRange.from,
			to: customDateRange.to,
		};
	}

	return undefined;
}

export function getInsightsPeriodLabel(
	period: InsightsPeriod,
	customDateRange?: DateRange,
): string {
	const appliedCustomRange = getAppliedInsightsDateRange(customDateRange);
	if (period === "custom" && appliedCustomRange) {
		return `${format(appliedCustomRange.from, "MMM d, yyyy")} – ${format(appliedCustomRange.to, "MMM d, yyyy")}`;
	}

	const option = INSIGHTS_PERIOD_OPTIONS.find(
		(entry) => entry.value === period,
	);
	return option?.label ?? "This month";
}

export function isInsightsWeekPeriod(
	period: InsightsPeriod,
): period is "this-week" | "last-week" {
	return period === "this-week" || period === "last-week";
}

export function insightsPeriodToMonths(period: InsightsPeriod): number {
	if (period === "custom" || isInsightsWeekPeriod(period)) {
		return 1;
	}

	const map: Record<
		Exclude<InsightsPeriod, "custom" | "this-week" | "last-week">,
		number
	> = {
		"this-month": 1,
		"last-month": 1,
		"1m": 1,
		"2m": 2,
		"3m": 3,
		"6m": 6,
		"12m": 12,
	};
	return map[period];
}

export function parseInsightsPeriod(value: string | null): InsightsPeriod {
	if (
		value === "this-week" ||
		value === "last-week" ||
		value === "this-month" ||
		value === "last-month" ||
		value === "1m" ||
		value === "2m" ||
		value === "3m" ||
		value === "6m" ||
		value === "12m" ||
		value === "custom"
	) {
		return value;
	}
	return DEFAULT_INSIGHTS_PERIOD;
}

export function parseInsightsTab(
	value: string | null,
): "spending" | "income" | "net-income" {
	if (value === "income" || value === "net-income" || value === "spending") {
		return value;
	}
	return DEFAULT_INSIGHTS_TAB;
}

export function buildInsightsInput(
	selection: InsightsPeriodSelection,
	categoryFilter?: {
		incomeCategories?: string[];
		expenseCategories?: string[];
	},
): InsightsInput {
	const appliedCustomRange = getAppliedInsightsDateRange(
		selection.customDateRange,
	);

	if (selection.period === "custom" && appliedCustomRange) {
		return {
			period: "custom",
			startDate: format(appliedCustomRange.from, "yyyy-MM-dd"),
			endDate: format(appliedCustomRange.to, "yyyy-MM-dd"),
			incomeCategories: categoryFilter?.incomeCategories,
			expenseCategories: categoryFilter?.expenseCategories,
		};
	}

	return {
		period: selection.period,
		incomeCategories: categoryFilter?.incomeCategories,
		expenseCategories: categoryFilter?.expenseCategories,
	};
}

function resolveInsightsWeekDateRange(
	period: "this-week" | "last-week",
	now: Date,
): { from: string; to: string } {
	if (period === "last-week") {
		const lastWeek = subWeeks(now, 1);
		return {
			from: format(
				startOfWeek(lastWeek, { weekStartsOn: INSIGHTS_WEEK_STARTS_ON }),
				"yyyy-MM-dd",
			),
			to: format(
				endOfWeek(lastWeek, { weekStartsOn: INSIGHTS_WEEK_STARTS_ON }),
				"yyyy-MM-dd",
			),
		};
	}

	return {
		from: format(
			startOfWeek(now, { weekStartsOn: INSIGHTS_WEEK_STARTS_ON }),
			"yyyy-MM-dd",
		),
		to: format(now, "yyyy-MM-dd"),
	};
}

export function buildSpendingInput(
	selection: InsightsPeriodSelection,
	monthsOverride?: number,
	expenseCategories?: string[],
): SpendingInput {
	if (isInsightsWeekPeriod(selection.period)) {
		const range = resolveInsightsWeekDateRange(selection.period, new Date());
		return {
			startDate: range.from,
			endDate: range.to,
			expenseCategories,
		};
	}

	if (selection.period === "last-month") {
		const lastMonth = subMonths(new Date(), 1);
		return {
			startDate: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
			endDate: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
			expenseCategories,
		};
	}

	const appliedCustomRange = getAppliedInsightsDateRange(
		selection.customDateRange,
	);

	if (selection.period === "custom" && appliedCustomRange) {
		return {
			startDate: format(appliedCustomRange.from, "yyyy-MM-dd"),
			endDate: format(appliedCustomRange.to, "yyyy-MM-dd"),
			expenseCategories,
		};
	}

	return {
		months: monthsOverride ?? insightsPeriodToMonths(selection.period),
		expenseCategories,
	};
}

export function getCustomRangeMonthCount(customDateRange: DateRange): number {
	const appliedCustomRange = getAppliedInsightsDateRange(customDateRange);
	if (!appliedCustomRange) {
		return 1;
	}

	return Math.max(
		1,
		differenceInCalendarMonths(appliedCustomRange.to, appliedCustomRange.from) +
			1,
	);
}

export function getInsightsPeriodMonthCount(
	selection: InsightsPeriodSelection,
): number {
	if (selection.period === "custom" && selection.customDateRange) {
		return getCustomRangeMonthCount(selection.customDateRange);
	}
	return insightsPeriodToMonths(selection.period);
}

export function insightsMonthlyAverage(
	total: number,
	selection: InsightsPeriodSelection,
): number {
	const months = getInsightsPeriodMonthCount(selection);
	return months > 0 ? total / months : 0;
}

export function showsInsightsMonthlyAverage(
	selection: InsightsPeriodSelection,
): boolean {
	return !isInsightsWeekPeriod(selection.period);
}

export function getInsightsQueryKeySuffix(
	selection: InsightsPeriodSelection,
): string {
	const appliedCustomRange = getAppliedInsightsDateRange(
		selection.customDateRange,
	);

	if (selection.period === "custom" && appliedCustomRange) {
		return `custom:${format(appliedCustomRange.from, "yyyy-MM-dd")}:${format(appliedCustomRange.to, "yyyy-MM-dd")}`;
	}

	return selection.period;
}

export function resolveInsightsDateRangeForSelection(
	selection: InsightsPeriodSelection,
	now = new Date(),
): { from: string; to: string } | undefined {
	const appliedCustomRange = getAppliedInsightsDateRange(
		selection.customDateRange,
	);

	if (selection.period === "custom" && appliedCustomRange) {
		return {
			from: format(appliedCustomRange.from, "yyyy-MM-dd"),
			to: format(appliedCustomRange.to, "yyyy-MM-dd"),
		};
	}

	if (isInsightsWeekPeriod(selection.period)) {
		return resolveInsightsWeekDateRange(selection.period, now);
	}

	if (selection.period === "last-month") {
		const lastMonth = subMonths(now, 1);
		return {
			from: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
			to: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
		};
	}

	const months = insightsPeriodToMonths(selection.period);
	return {
		from: format(startOfMonth(subMonths(now, months - 1)), "yyyy-MM-dd"),
		to: format(now, "yyyy-MM-dd"),
	};
}
