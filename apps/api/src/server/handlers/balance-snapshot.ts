import { addMonths, format } from "date-fns";
import { z } from "zod";
import {
	forecastInvestmentGrowth,
	projectRealEstateEquity,
} from "~/lib/forecasting";
import { createApiError } from "../api-context";
import { type DemoOrAuthContext, withDemoOrAuth } from "../handler-wrappers";
import { getAssetHistory } from "../services/balance-snapshot.service";
import { getRolledUpHistoricalNetWorth } from "../services/profiles/net-worth-rollup.service";

const getHistoryInput = z.object({
	months: z.number().int().min(1).max(60).default(24),
	forecastMonths: z.preprocess(
		(v) => (v === undefined || v === "" ? undefined : Number(v)),
		z.number().int().min(1).max(600).optional(),
	),
});

export const balanceSnapshot = {
	/**
	 * Returns monthly net worth data points derived from balance snapshots.
	 * For each month, takes the last sync day in that month and sums all
	 * source balances — giving one total per month for the historical chart.
	 *
	 * When the owner Personal profile is active, opted-in Family/Business
	 * profile totals are summed into historical points (read-time only).
	 */
	getHistory: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = getHistoryInput.parse(body);
		const { userId } = ctx;

		const historical = await getRolledUpHistoricalNetWorth(ctx.db, {
			actorUserId: ctx.actorUserId,
			effectiveUserId: ctx.effectiveUserId,
			isHouseholdMember: ctx.isHouseholdMember,
			months: input.months,
		});

		if (!input.forecastMonths) {
			return { historical, forecast: [] };
		}

		const currentNetWorth = historical.at(-1)?.total ?? 0;
		const [manualInvestments, plaidInvestmentAccounts, realEstateProperties] =
			await Promise.all([
				ctx.db.investment.findMany({
					where: { userId },
					select: {
						startingBalance: true,
						monthlyContribution: true,
						annualReturnRate: true,
					},
				}),
				ctx.db.plaidAccount.findMany({
					where: {
						userId,
						type: "investment",
						isActive: true,
						investmentHidden: false,
					},
					select: {
						currentBalance: true,
						monthlyContribution: true,
						annualReturnRate: true,
					},
				}),
				ctx.db.realEstateInvestment.findMany({
					where: { userId },
					select: {
						currentEstimatedValue: true,
						currentLoanBalance: true,
						appreciationRate: true,
						interestRate: true,
						monthlyMortgagePayment: true,
					},
				}),
			]);

		const investments = [
			...manualInvestments.map((investment) => ({
				startingBalance: investment.startingBalance,
				monthlyContribution: investment.monthlyContribution,
				annualReturnRate: investment.annualReturnRate,
			})),
			...plaidInvestmentAccounts.map((account) => ({
				startingBalance: account.currentBalance ?? 0,
				monthlyContribution: account.monthlyContribution,
				annualReturnRate: account.annualReturnRate,
			})),
		];

		const currentInvestmentTotal = investments.reduce(
			(sum, investment) => sum + investment.startingBalance,
			0,
		);
		const currentRealEstateEquity = realEstateProperties.reduce(
			(sum, p) => sum + (p.currentEstimatedValue - p.currentLoanBalance),
			0,
		);
		// Non-investment portion of the consolidated total stays fixed.
		// Child contribution schedules are not included in phase-1 forecast.
		const nonInvestmentNetWorth =
			currentNetWorth - currentInvestmentTotal - currentRealEstateEquity;

		const investmentProjections = investments.map((investment) =>
			forecastInvestmentGrowth(investment, input.forecastMonths ?? 0),
		);
		const realEstateProjections = realEstateProperties.map((p) =>
			projectRealEstateEquity(p, input.forecastMonths ?? 0),
		);

		const forecast = Array.from(
			{ length: input.forecastMonths },
			(_, index) => {
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
				return {
					month: format(addMonths(new Date(), index + 1), "yyyy-MM"),
					total:
						nonInvestmentNetWorth +
						totalInvestmentBalance +
						totalRealEstateEquity,
					isForecast: true,
				};
			},
		);

		return { historical, forecast };
	}),

	/**
	 * Returns monthly last-snapshot points for a single investment, Plaid
	 * account, or real estate property.
	 */
	getAssetHistory: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = z
				.object({
					source: z.enum(["PLAID", "INVESTMENT", "REAL_ESTATE"]),
					sourceId: z.string().min(1),
					months: z.number().int().min(1).max(60).default(24),
				})
				.parse(body);

			const result = await getAssetHistory(ctx.db, {
				userId: ctx.userId,
				source: input.source,
				sourceId: input.sourceId,
				months: input.months,
			});
			if (!result) {
				throw createApiError("Asset not found", 404);
			}
			return result;
		},
	),
};
