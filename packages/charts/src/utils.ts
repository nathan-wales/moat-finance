export function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatCompactCurrency(value: number): string {
	const absolute = Math.abs(value);
	const sign = value < 0 ? "-" : "";
	if (absolute >= 1_000_000_000) {
		const billions = absolute / 1_000_000_000;
		const digits = absolute >= 10_000_000_000 ? 1 : 2;
		const trimmed = Number(billions.toFixed(digits));
		return `${sign}$${trimmed}B`;
	}
	if (absolute >= 1_000_000) {
		const millions = absolute / 1_000_000;
		const digits = absolute >= 10_000_000 ? 1 : 2;
		const trimmed = Number(millions.toFixed(digits));
		return `${sign}$${trimmed}M`;
	}
	if (absolute >= 10_000) {
		return `${sign}$${Math.round(absolute / 1000)}k`;
	}
	if (absolute === 0) return "$0";
	return formatCurrency(value);
}

export function shouldShowTodayDollars(
	nominal: number,
	todayAmount: number | null | undefined,
): todayAmount is number {
	if (todayAmount === null || todayAmount === undefined) return false;
	return Math.abs(nominal - todayAmount) >= 1;
}

export function formatTodayDollarsLabel(todayAmount: number): string {
	return `≈ ${formatCompactCurrency(todayAmount)} in today's value`;
}

export function formatMonthLabel(month: string): string {
	const [yearStr, monthStr] = month.split("-");
	if (!yearStr || !monthStr) return month;
	const year = Number.parseInt(yearStr, 10);
	const monthNum = Number.parseInt(monthStr, 10) - 1;
	const date = new Date(year, monthNum, 1);
	return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export interface MonthlyDataPoint {
	month: string; // "YYYY-MM"
	income: number;
	expenses: number;
	netGain: number;
}
// ─── Investment Growth Forecast ───────────────────────────────────────────────

export interface InvestmentInputs {
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
}

/**
 * Projects investment growth using compound interest formula.
 * Returns monthly balance values for the given number of months.
 */
export function forecastInvestmentGrowth(
	inputs: InvestmentInputs,
	months: number,
): { month: string; balance: number; isForecast: boolean }[] {
	const monthlyRate = inputs.annualReturnRate / 12;
	let balance = inputs.startingBalance;
	const now = new Date();
	const points: { month: string; balance: number; isForecast: boolean }[] = [];

	for (let i = 1; i <= months; i++) {
		const year = now.getFullYear();
		const month = now.getMonth() + i;
		const date = new Date(year, month, 1);
		const yyyy = date.getFullYear();
		const mm = String(date.getMonth() + 1).padStart(2, "0");
		balance = balance * (1 + monthlyRate) + inputs.monthlyContribution;
		points.push({
			month: `${yyyy}-${mm}`,
			balance,
			isForecast: true,
		});
	}

	return points;
}

// ─── Real Estate Types ────────────────────────────────────────────────────────

export interface RealEstateProjectionPoint {
	year: number;
	projectedPropertyValue: number;
	projectedLoanBalance: number;
	projectedEquity: number;
	annualCashFlow: number;
	cumulativeCashFlow: number;
	totalGain: number;
	totalCashInvested: number;
	roiPercent: number | null;
}
