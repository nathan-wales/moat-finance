import { addMonths, format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyDataPoint {
	month: string; // "YYYY-MM"
	income: number;
	expenses: number;
	netGain: number;
}

export interface ForecastPoint {
	month: string;
	value: number;
	isForecast: boolean;
}

export interface InvestmentInputs {
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
}

export interface ScenarioMultipliers {
	annualReturnRate: number;
	inflationRate: number;
	salaryGrowth: number;
	contributionChange: number;
	expenseGrowth: number;
}

// ─── Preset Scenarios ─────────────────────────────────────────────────────────

export const SCENARIO_PRESETS: {
	CONSERVATIVE: ScenarioMultipliers;
	STANDARD: ScenarioMultipliers;
	AGGRESSIVE: ScenarioMultipliers;
} = {
	CONSERVATIVE: {
		annualReturnRate: 0.04,
		inflationRate: 0.04,
		salaryGrowth: 0.01,
		contributionChange: 0,
		expenseGrowth: 0.04,
	},
	STANDARD: {
		annualReturnRate: 0.07,
		inflationRate: 0.03,
		salaryGrowth: 0.03,
		contributionChange: 0.02,
		expenseGrowth: 0.03,
	},
	AGGRESSIVE: {
		annualReturnRate: 0.1,
		inflationRate: 0.02,
		salaryGrowth: 0.06,
		contributionChange: 0.05,
		expenseGrowth: 0.02,
	},
};

// ─── Net Gain Forecast ────────────────────────────────────────────────────────

/**
 * Projects monthly net gain forward from the last historical date.
 * Uses average historical net gain, adjusted by scenario multipliers.
 */
export function forecastNetGains(
	historicalData: MonthlyDataPoint[],
	forecastMonths: number,
	scenario?: Partial<ScenarioMultipliers>,
): ForecastPoint[] {
	const last = historicalData.at(-1);
	if (!last) return [];

	const avgNetGain =
		historicalData.reduce((sum, d) => sum + d.netGain, 0) /
		historicalData.length;

	const incomeGrowthPerMonth = scenario?.salaryGrowth
		? scenario.salaryGrowth / 12
		: 0;
	const expenseGrowthPerMonth = scenario?.expenseGrowth
		? scenario.expenseGrowth / 12
		: 0;

	const avgIncome =
		historicalData.reduce((sum, d) => sum + d.income, 0) /
		historicalData.length;
	const avgExpenses =
		historicalData.reduce((sum, d) => sum + d.expenses, 0) /
		historicalData.length;

	const lastDate = parseMonthKey(last.month);
	const points: ForecastPoint[] = [];

	for (let i = 1; i <= forecastMonths; i++) {
		const date = addMonths(lastDate, i);
		const projectedIncome = avgIncome * (1 + incomeGrowthPerMonth) ** i;
		const projectedExpenses = avgExpenses * (1 + expenseGrowthPerMonth) ** i;
		const projectedNetGain = scenario
			? projectedIncome - projectedExpenses
			: avgNetGain;

		points.push({
			month: format(date, "yyyy-MM"),
			value: projectedNetGain,
			isForecast: true,
		});
	}

	return points;
}

// ─── Net Worth Forecast ───────────────────────────────────────────────────────

/**
 * Builds a complete net worth series: historical + forecast.
 * Net worth = cumulative net gains + current investment portfolio value.
 *
 * Since we don't track historical investment balances month-by-month,
 * we use currentInvestmentTotal as a fixed base on all historical points
 * and compound it forward for the forecast period.
 */
export function buildNetWorthSeries(
	monthlyData: MonthlyDataPoint[],
	currentInvestmentTotal: number,
	forecastMonths: number,
	scenario?: Partial<ScenarioMultipliers>,
): { month: string; netWorth: number; isForecast: boolean }[] {
	if (monthlyData.length === 0) return [];

	// Build historical series — add current investment total as a fixed base
	let cumulativeNetGain = 0;
	const historical = monthlyData.map((d) => {
		cumulativeNetGain += d.netGain;
		return {
			month: d.month,
			netWorth: cumulativeNetGain + currentInvestmentTotal,
			isForecast: false,
		};
	});

	const lastNetWorth = historical.at(-1)?.netWorth ?? 0;
	const forecasted = forecastNetGains(monthlyData, forecastMonths, scenario);
	let runningNetWorth = lastNetWorth;

	const forecastSeries = forecasted.map((f, i) => {
		runningNetWorth += f.value;
		// Compound the investment total forward
		const invGrowthRate = scenario?.annualReturnRate ?? 0.07;
		const projectedInv =
			currentInvestmentTotal * (1 + invGrowthRate / 12) ** (i + 1);
		return {
			month: f.month,
			netWorth: runningNetWorth - currentInvestmentTotal + projectedInv,
			isForecast: true,
		};
	});

	return [...historical, ...forecastSeries];
}

// ─── Investment Growth Forecast ───────────────────────────────────────────────

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
		balance = balance * (1 + monthlyRate) + inputs.monthlyContribution;
		points.push({
			month: format(addMonths(now, i), "yyyy-MM"),
			balance,
			isForecast: true,
		});
	}

	return points;
}

// ─── Net Worth Projection ─────────────────────────────────────────────────────

/**
 * Projects a current net worth total forward using simple monthly compounding.
 * Used by the Net Worth chart to draw scenario forecast lines.
 */
export function projectNetWorth(
	currentTotal: number,
	months: number,
	annualReturnRate: number,
): { month: string; value: number }[] {
	const monthlyRate = annualReturnRate / 12;
	const now = new Date();
	return Array.from({ length: months }, (_, i) => ({
		month: format(addMonths(now, i + 1), "yyyy-MM"),
		value: currentTotal * (1 + monthlyRate) ** (i + 1),
	}));
}

// ─── Real Estate Equity Forecast ─────────────────────────────────────────────

export interface RealEstateInputs {
	currentEstimatedValue: number;
	currentLoanBalance: number;
	appreciationRate?: number | null;
	interestRate?: number | null;
	monthlyMortgagePayment?: number | null;
}

/**
 * Projects real estate equity forward month by month, modeling both:
 *   1. Property appreciation (compounded monthly)
 *   2. Mortgage amortization (principal paydown accelerates over time)
 *
 * Equity = projectedPropertyValue - remainingLoanBalance
 *
 * If interestRate or monthlyMortgagePayment are unavailable, the loan
 * balance is held fixed (only appreciation is modeled).
 */
export function projectRealEstateEquity(
	inputs: RealEstateInputs,
	months: number,
): { month: string; equity: number; isForecast: boolean }[] {
	const now = new Date();
	const annualAppreciation = inputs.appreciationRate ?? 0.04;
	const monthlyAppreciationRate = annualAppreciation / 12;

	const canAmortize =
		inputs.interestRate != null &&
		inputs.monthlyMortgagePayment != null &&
		inputs.currentLoanBalance > 0;

	const monthlyInterestRate = canAmortize ? (inputs.interestRate ?? 0) / 12 : 0;
	const monthlyPayment = inputs.monthlyMortgagePayment ?? 0;

	return Array.from({ length: months }, (_, i) => {
		const m = i + 1;
		const projectedValue =
			inputs.currentEstimatedValue * (1 + monthlyAppreciationRate) ** m;

		let remainingBalance: number;
		if (canAmortize && monthlyInterestRate > 0) {
			// Standard amortization: B(m) = B0*(1+r)^m - P*((1+r)^m - 1)/r
			const factor = (1 + monthlyInterestRate) ** m;
			remainingBalance = Math.max(
				0,
				inputs.currentLoanBalance * factor -
					monthlyPayment * ((factor - 1) / monthlyInterestRate),
			);
		} else {
			remainingBalance = inputs.currentLoanBalance;
		}

		return {
			month: format(addMonths(now, m), "yyyy-MM"),
			equity: projectedValue - remainingBalance,
			isForecast: true,
		};
	});
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMonthKey(key: string): Date {
	const [year, month] = key.split("-").map(Number) as [number, number];
	return new Date(year, month - 1, 1);
}

export function formatMonthLabel(month: string): string {
	const date = parseMonthKey(month);
	return format(date, "MMM yyyy");
}

export function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}
