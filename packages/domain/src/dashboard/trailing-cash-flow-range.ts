import { endOfDay, startOfMonth, subMonths } from "date-fns";

export type TrailingCashFlowRange = {
	startDate: Date;
	endDate: Date;
};

/**
 * Same window Insights uses for the `12m` (and other N-month) periods:
 * start of the month N-1 months ago through end of today.
 */
export function trailingCashFlowRange(
	months: number,
	now: Date = new Date(),
): TrailingCashFlowRange {
	const safeMonths = Math.max(1, Math.floor(months));
	return {
		startDate: startOfMonth(subMonths(now, safeMonths - 1)),
		endDate: endOfDay(now),
	};
}
