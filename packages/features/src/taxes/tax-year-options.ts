const PAST_YEAR_COUNT = 20;
const FUTURE_YEAR_COUNT = 2;

export function buildTaxYearOptions(
	chromeYear: number,
	extraYears: number[] = [],
): number[] {
	return [
		...new Set([
			...Array.from(
				{ length: PAST_YEAR_COUNT + FUTURE_YEAR_COUNT },
				(_, index) => chromeYear + FUTURE_YEAR_COUNT - index,
			),
			...extraYears,
		]),
	].sort((left, right) => right - left);
}
