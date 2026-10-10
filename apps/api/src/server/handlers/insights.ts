import { getInsightsCategoryActivity } from "../../lib/insights/category-activity";
import { getIncomeInsights } from "../../lib/insights/income-service";
import { getNetIncomeInsights } from "../../lib/insights/net-income-service";
import { InsightsInputSchema } from "../../lib/insights/types";
import { createApiAppContext } from "../createApiAppContext";
import { type DemoOrAuthContext, withDemoOrAuth } from "../handler-wrappers";
import { getEffectiveNow } from "../lib/reporting-period";

function getCustomInsightsRange(input: {
	period: string;
	startDate?: string;
	endDate?: string;
}) {
	if (input.period !== "custom" || !input.startDate || !input.endDate) {
		return undefined;
	}

	return {
		startDate: input.startDate,
		endDate: input.endDate,
	};
}

export const insights = {
	getIncomeInsights: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = InsightsInputSchema.parse(body);
			return getIncomeInsights(
				ctx.db,
				ctx.userId,
				input.period,
				getEffectiveNow(ctx),
				getCustomInsightsRange(input),
				input.incomeCategories,
			);
		},
	),

	getCategoryActivity: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = InsightsInputSchema.parse(body);
			return getInsightsCategoryActivity(
				ctx.db,
				ctx.userId,
				input.period,
				getEffectiveNow(ctx),
				getCustomInsightsRange(input),
			);
		},
	),

	getNetIncomeInsights: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = InsightsInputSchema.parse(body);
			const appCtx = createApiAppContext(ctx.userId, ctx.db);
			return getNetIncomeInsights(
				appCtx,
				ctx.db,
				input.period,
				getEffectiveNow(ctx),
				getCustomInsightsRange(input),
				{
					incomeCategories: input.incomeCategories,
					expenseCategories: input.expenseCategories,
				},
			);
		},
	),
};
