/**
 * Tax year helpers. The year always comes from the financial event or
 * calculation — never from a global "current limits" constant.
 */

/** Calendar tax year for a date (UTC). */
export function getTaxYear(date: Date = new Date()): number {
	return date.getUTCFullYear();
}

/**
 * Tax years for which an IRA or HSA contribution may still be made as of
 * `asOf`. Prior-year contributions are generally allowed through April 15 of
 * the following calendar year (no holiday/extension calendar in v1).
 *
 * Workplace elective deferrals are calendar-year only and are not returned here.
 */
export function openContributionYears(asOf: Date = new Date()): number[] {
	const year = getTaxYear(asOf);
	const month = asOf.getUTCMonth(); // 0-indexed
	const day = asOf.getUTCDate();
	const priorYearStillOpen = month < 3 || (month === 3 && day <= 15);
	if (priorYearStillOpen) {
		return [year - 1, year];
	}
	return [year];
}

export function latestOfficialYear(years: readonly number[]): number {
	const sorted = [...years].sort((a, b) => a - b);
	const last = sorted.at(-1);
	if (last === undefined) {
		throw new Error("Official rules table is empty");
	}
	return last;
}
