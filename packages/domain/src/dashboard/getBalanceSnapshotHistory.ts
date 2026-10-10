import type { AppContext } from "../context";
import {
	forecastInvestmentGrowth,
	projectRealEstateEquity,
} from "../forecasts/project-growth";
import { accountNetWorthContribution } from "./account-net-worth";
import { getMonthlyAggregates } from "./getMonthlyAggregates";

const DEFAULT_INVESTMENT_RETURN_RATE = 0.07;

export type GetBalanceSnapshotHistoryInput = {
	/** Number of months of history (default: 24) */
	months?: number;
	/** Months to project forward; omit or 0 for no forecast */
	forecastMonths?: number;
	/** Override "now" — useful for tests */
	now?: Date;
};

export type BalanceSnapshotPoint = {
	month: string;
	total: number;
};

export type BalanceSnapshotHistoryResult = {
	historical: BalanceSnapshotPoint[];
	forecast: BalanceSnapshotPoint[];
};

/**
 * Builds net-worth history + retirement-style forecast for the desktop chart.
 *
 * Historical points are reconstructed from monthly cash-flow aggregates,
 * anchored to current net worth (accounts + manual investments + real estate).
 *
 * Forecast compounds investable assets and real-estate equity — matching the
 * cloud API — instead of only adding average monthly cash-flow gains.
 */
export async function getBalanceSnapshotHistory(
	ctx: AppContext,
	input: GetBalanceSnapshotHistoryInput = {},
): Promise<BalanceSnapshotHistoryResult> {
	const months = input.months ?? 24;
	const forecastMonths = input.forecastMonths ?? 0;
	const now = input.now ?? new Date();

	const investmentsRepo = ctx.repositories.investments;
	const realEstateRepo = ctx.repositories.realEstate;

	const [aggregates, accounts, manualInvestments, realEstateProperties] =
		await Promise.all([
			getMonthlyAggregates(ctx, { months, now }),
			ctx.repositories.accounts.listForSummary({ userId: ctx.userId }),
			investmentsRepo?.list({ userId: ctx.userId }) ?? Promise.resolve([]),
			realEstateRepo?.list({ userId: ctx.userId }) ?? Promise.resolve([]),
		]);

	const visibleAccounts = accounts.filter(
		(a) => !a.isHidden && a.currentBalance !== null,
	);
	const accountNetWorth = visibleAccounts.reduce(
		(sum, a) => sum + accountNetWorthContribution(a),
		0,
	);

	const plaidInvestmentAccounts = visibleAccounts.filter(
		(a) => a.type === "investment",
	);

	const investments = [
		...manualInvestments.map((investment) => ({
			startingBalance: investment.startingBalance,
			monthlyContribution: investment.monthlyContribution,
			annualReturnRate: investment.annualReturnRate,
		})),
		...plaidInvestmentAccounts.map((account) => ({
			startingBalance: account.currentBalance ?? 0,
			monthlyContribution: 0,
			annualReturnRate: DEFAULT_INVESTMENT_RETURN_RATE,
		})),
	];

	const currentInvestmentTotal = investments.reduce(
		(sum, investment) => sum + investment.startingBalance,
		0,
	);
	const currentRealEstateEquity = realEstateProperties.reduce(
		(sum, property) =>
			sum + (property.currentEstimatedValue - property.currentLoanBalance),
		0,
	);

	// Manual investments and real estate sit outside account balances.
	const currentNetWorth =
		accountNetWorth +
		manualInvestments.reduce((sum, inv) => sum + inv.startingBalance, 0) +
		currentRealEstateEquity;

	const totalHistoricalGain = aggregates.months.reduce(
		(sum, m) => sum + m.netGain,
		0,
	);
	let baseline = currentNetWorth - totalHistoricalGain;
	const historical = aggregates.months.map((m) => {
		baseline += m.netGain;
		return { month: m.month, total: baseline };
	});

	if (forecastMonths <= 0) {
		return { historical, forecast: [] };
	}

	const nonInvestmentNetWorth =
		currentNetWorth - currentInvestmentTotal - currentRealEstateEquity;

	const investmentProjections = investments.map((investment) =>
		forecastInvestmentGrowth(investment, forecastMonths, now),
	);
	const realEstateProjections = realEstateProperties.map((property) =>
		projectRealEstateEquity(property, forecastMonths, now),
	);

	const forecast = Array.from({ length: forecastMonths }, (_, index) => {
		const totalInvestmentBalance = investmentProjections.reduce(
			(sum, projection, investmentIndex) =>
				sum +
				(projection[index]?.balance ??
					investments[investmentIndex]?.startingBalance ??
					0),
			0,
		);
		const totalRealEstateEquity = realEstateProjections.reduce(
			(sum, projection, propIndex) => {
				const property = realEstateProperties[propIndex];
				const fallbackEquity = property
					? property.currentEstimatedValue - property.currentLoanBalance
					: 0;
				return sum + (projection[index]?.equity ?? fallbackEquity);
			},
			0,
		);

		const d = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
		const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

		return {
			month,
			total:
				nonInvestmentNetWorth + totalInvestmentBalance + totalRealEstateEquity,
		};
	});

	return { historical, forecast };
}
