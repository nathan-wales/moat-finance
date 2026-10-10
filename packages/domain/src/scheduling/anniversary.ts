export const MAX_ANNIVERSARY_CATCH_UP_MONTHS = 24;

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

function daysInUtcMonth(year: number, monthIndex: number): number {
	return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Anniversary date for a given year/month, clamped to the last day of the month
 * when the creation day does not exist (e.g. Jan 31 → Feb 28/29).
 */
export function anniversaryDateInMonth(
	anchor: Date,
	year: number,
	monthIndex: number,
): Date {
	const day = anchor.getUTCDate();
	const clampedDay = Math.min(day, daysInUtcMonth(year, monthIndex));
	return new Date(Date.UTC(year, monthIndex, clampedDay));
}

export function addOneAnniversaryMonth(from: Date, anchor: Date): Date {
	const nextMonthIndex = from.getUTCMonth() + 1;
	const year = from.getUTCFullYear() + Math.floor(nextMonthIndex / 12);
	const monthIndex = ((nextMonthIndex % 12) + 12) % 12;
	return anniversaryDateInMonth(anchor, year, monthIndex);
}

/**
 * First due date after `lastAppliedAt` (or after anchor when never applied).
 * Always at least one anniversary month after the watermark.
 */
export function computeNextAnniversaryDueAt(
	anchor: Date,
	lastAppliedAt: Date | null | undefined,
): Date {
	const from = lastAppliedAt ?? anchor;
	return addOneAnniversaryMonth(startOfUtcDay(from), anchor);
}

export function initialNextAnniversaryDueAt(anchor: Date): Date {
	return addOneAnniversaryMonth(startOfUtcDay(anchor), anchor);
}

export type PlannedAnniversaryMonth = {
	periodStart: Date;
	periodEnd: Date;
};

/**
 * Ordered months to apply for catch-up, each ending on an anniversary date.
 */
export function planAnniversaryCatchUpMonths(input: {
	anchor: Date;
	lastAppliedAt?: Date | null;
	nextDueAt?: Date | null;
	now: Date;
	isEligible: boolean;
	maxMonths?: number;
}): PlannedAnniversaryMonth[] {
	if (!input.isEligible) return [];

	const maxMonths = input.maxMonths ?? MAX_ANNIVERSARY_CATCH_UP_MONTHS;
	const nowDay = startOfUtcDay(input.now);
	const dueAt =
		input.nextDueAt != null
			? startOfUtcDay(input.nextDueAt)
			: computeNextAnniversaryDueAt(input.anchor, input.lastAppliedAt);

	if (dueAt.getTime() > nowDay.getTime()) return [];

	const months: PlannedAnniversaryMonth[] = [];
	let periodStart = startOfUtcDay(input.lastAppliedAt ?? input.anchor);
	let periodEnd = dueAt;

	while (months.length < maxMonths && periodEnd.getTime() <= nowDay.getTime()) {
		months.push({ periodStart, periodEnd });
		periodStart = periodEnd;
		periodEnd = addOneAnniversaryMonth(periodStart, input.anchor);
	}

	return months;
}

export { startOfUtcDay };
