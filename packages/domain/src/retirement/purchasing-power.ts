/** CPI factor from today to a future year index. Year 0 is 1. */
export function inflationFactorForYear(
	inflationRate: number,
	yearIndex: number,
): number {
	return (1 + inflationRate) ** Math.max(0, yearIndex);
}

/** Deflates a nominal future amount back to today's purchasing power. */
export function toTodayDollars(
	nominal: number,
	inflationRate: number,
	yearIndex: number,
): number {
	const factor = inflationFactorForYear(inflationRate, yearIndex);
	if (factor <= 0) return nominal;
	return nominal / factor;
}
