import {
	endOfMonth,
	format,
	getDate,
	getDaysInMonth,
	startOfMonth,
	subMonths,
} from "date-fns";

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const TRAILING_MONTHS = 12;

export type BudgetReportingMonth = {
	monthKey: string;
	periodStart: Date;
	periodEnd: Date;
	startDate: string;
	endDate: string;
	dayOfMonth: number;
	daysInMonth: number;
	isCurrentMonth: boolean;
	effectiveNow: Date;
};

export function parseBudgetMonthKey(value: string | undefined): Date | null {
	if (!value || !MONTH_KEY_PATTERN.test(value)) return null;
	const [yearPart, monthPart] = value.split("-");
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
	return startOfMonth(new Date(year, monthNumber - 1, 1));
}

export function budgetMonthKey(date: Date): string {
	return format(startOfMonth(date), "yyyy-MM");
}

export function earliestBudgetMonthStart(now: Date): Date {
	return startOfMonth(subMonths(now, TRAILING_MONTHS - 1));
}

/**
 * Resolves an optional yyyy-MM against "now".
 * Omit, invalid, future, or older than 12 months falls back to the current month.
 * Past months in range are treated as complete (dayOfMonth = daysInMonth).
 */
export function resolveBudgetReportingMonth(input: {
	now: Date;
	month?: string;
}): BudgetReportingMonth {
	const currentStart = startOfMonth(input.now);
	const earliestStart = earliestBudgetMonthStart(input.now);
	const requested = parseBudgetMonthKey(input.month);

	const inRange =
		requested !== null &&
		requested.getTime() >= earliestStart.getTime() &&
		requested.getTime() <= currentStart.getTime();
	const periodStart = inRange && requested ? requested : currentStart;
	const isCurrentMonth = periodStart.getTime() === currentStart.getTime();
	const periodEnd = endOfMonth(periodStart);
	const daysInMonth = getDaysInMonth(periodStart);
	const dayOfMonth = isCurrentMonth ? getDate(input.now) : daysInMonth;

	return {
		monthKey: budgetMonthKey(periodStart),
		periodStart,
		periodEnd,
		startDate: format(periodStart, "yyyy-MM-dd"),
		endDate: format(periodEnd, "yyyy-MM-dd"),
		dayOfMonth,
		daysInMonth,
		isCurrentMonth,
		effectiveNow: isCurrentMonth ? input.now : periodEnd,
	};
}
