import {
	endOfMonth,
	format,
	getDate,
	getDaysInMonth,
	startOfMonth,
} from "date-fns";

const DEMO_SNAPSHOT_DATE = new Date(2026, 3, 30, 12, 0, 0, 0);

export interface ReportingMonth {
	effectiveNow: Date;
	monthStartDate: Date;
	monthEndDate: Date;
	startDate: string;
	endDate: string;
	dayOfMonth: number;
	daysInMonth: number;
	isDemoSnapshot: boolean;
}

export function getEffectiveNow(
	ctx: { isDemoMode: boolean },
	now: Date = new Date(),
): Date {
	return ctx.isDemoMode ? new Date(DEMO_SNAPSHOT_DATE) : now;
}

export function getReportingMonth(
	ctx: { isDemoMode: boolean },
	now: Date = new Date(),
): ReportingMonth {
	const effectiveNow = getEffectiveNow(ctx, now);
	const monthStartDate = startOfMonth(effectiveNow);
	const monthEndDate = endOfMonth(effectiveNow);

	return {
		effectiveNow,
		monthStartDate,
		monthEndDate,
		startDate: format(monthStartDate, "yyyy-MM-dd"),
		endDate: format(monthEndDate, "yyyy-MM-dd"),
		dayOfMonth: getDate(effectiveNow),
		daysInMonth: getDaysInMonth(effectiveNow),
		isDemoSnapshot: ctx.isDemoMode,
	};
}
