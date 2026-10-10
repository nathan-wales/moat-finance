export function formatMoney(value: number): string {
	const absolute = Math.abs(value);
	const sign = value < 0 ? "-" : "";
	if (absolute >= 1_000_000) {
		return `${sign}$${(absolute / 1_000_000).toFixed(absolute >= 10_000_000 ? 1 : 2)}M`;
	}
	if (absolute >= 10_000) {
		return `${sign}$${Math.round(absolute / 1000)}k`;
	}
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatExactMoney(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatSignedMoney(value: number): string {
	if (value === 0) return formatMoney(0);
	const formatted = formatMoney(Math.abs(value));
	return value > 0 ? `+${formatted}` : `−${formatted}`;
}

export function formatPercent(value: number, digits = 0): string {
	return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPoints(value: number): string {
	const points = Math.round(value * 100);
	if (points === 0) return "0 pts";
	return `${points > 0 ? "+" : ""}${points} pts`;
}

export function formatAge(age: number | null | undefined): string {
	if (age === null || age === undefined) return "—";
	return String(age);
}

export function formatMonthly(value: number): string {
	return `${formatMoney(value)}/mo`;
}

/**
 * Cash-flow figures the user reconciles against their own arithmetic. The
 * compact form rounds anything past $10,000, which turns −$12,191 into −$12k.
 */
export function formatExactMonthly(value: number): string {
	return `${formatExactMoney(value)}/mo`;
}

export function formatAnnual(value: number): string {
	return `${formatMoney(value)}/yr`;
}

export function formatMonthlyLong(value: number): string {
	return `${formatMoney(value)} / month`;
}

export function formatYears(count: number): string {
	return `${count} year${count === 1 ? "" : "s"}`;
}

export function formatTodayDollarsLabel(todayAmount: number): string {
	return `≈ ${formatMoney(todayAmount)} in today's dollars`;
}

export function shouldShowTodayDollars(
	nominal: number,
	todayAmount: number | null | undefined,
): todayAmount is number {
	if (todayAmount === null || todayAmount === undefined) return false;
	return Math.abs(nominal - todayAmount) >= 1;
}
