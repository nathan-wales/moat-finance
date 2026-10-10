import {
	differenceInCalendarDays,
	endOfDay,
	endOfMonth,
	endOfWeek,
	parseISO,
	startOfDay,
	startOfMonth,
	startOfWeek,
	subMonths,
	subWeeks,
} from "date-fns";
import type { InsightsPeriod } from "./types";

export type InsightsDateRange = {
	startDate: Date;
	endDate: Date;
};

const INSIGHTS_WEEK_STARTS_ON = 1 as const;

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

export function parseInsightsDateParam(value: string): Date {
	return startOfDay(parseISO(value));
}

export function resolveInsightsDateRange(
	period: InsightsPeriod,
	now: Date,
	customRange?: { startDate: string; endDate: string },
): InsightsDateRange {
	if (period === "custom") {
		if (!customRange?.startDate || !customRange.endDate) {
			throw new Error("Custom insights period requires startDate and endDate");
		}

		return {
			startDate: parseInsightsDateParam(customRange.startDate),
			endDate: endOfDay(parseInsightsDateParam(customRange.endDate)),
		};
	}

	if (isInsightsWeekPeriod(period)) {
		return resolveInsightsWeekDateRange(period, now);
	}

	if (period === "last-month") {
		const lastMonth = subMonths(now, 1);
		return {
			startDate: startOfMonth(lastMonth),
			endDate: endOfDay(endOfMonth(lastMonth)),
		};
	}

	const months = insightsPeriodToMonths(period);
	return {
		startDate: startOfMonth(subMonths(now, months - 1)),
		endDate: endOfDay(now),
	};
}

function resolveInsightsWeekDateRange(
	period: "this-week" | "last-week",
	now: Date,
): InsightsDateRange {
	if (period === "last-week") {
		const lastWeek = subWeeks(now, 1);
		return {
			startDate: startOfWeek(lastWeek, {
				weekStartsOn: INSIGHTS_WEEK_STARTS_ON,
			}),
			endDate: endOfDay(
				endOfWeek(lastWeek, { weekStartsOn: INSIGHTS_WEEK_STARTS_ON }),
			),
		};
	}

	return {
		startDate: startOfWeek(now, { weekStartsOn: INSIGHTS_WEEK_STARTS_ON }),
		endDate: endOfDay(now),
	};
}

export function getInsightsDateRange(
	period: InsightsPeriod,
	now: Date,
	customRange?: { startDate: string; endDate: string },
): InsightsDateRange {
	return resolveInsightsDateRange(period, now, customRange);
}

export function usesWeeklyBuckets(period: InsightsPeriod): boolean {
	return (
		isInsightsWeekPeriod(period) ||
		period === "this-month" ||
		period === "last-month" ||
		period === "1m" ||
		period === "2m" ||
		period === "3m"
	);
}

export function usesWeeklyBucketsForRange(
	startDate: Date,
	endDate: Date,
): boolean {
	return differenceInCalendarDays(endDate, startDate) <= 93;
}
