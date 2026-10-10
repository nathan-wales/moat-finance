import type { RecurringIncomeRuleParams } from "@moat/contracts";
import type { StandingRuleModule } from "./types";

/**
 * The escape hatch on the income side: consulting work, alimony, family
 * support, a board seat. One rule kind covers all of them, which is what keeps
 * the schema from sprouting a column per life situation.
 */
export const recurringIncomeRule: StandingRuleModule<
	"RECURRING_INCOME",
	RecurringIncomeRuleParams
> = {
	kind: "RECURRING_INCOME",

	defaultParams(ctx) {
		return {
			annualAmount: 0,
			window: {
				fromAge: ctx.retirementAge,
				toAge: null,
				inflates: true,
				everyNYears: null,
			},
			taxTreatment: "ordinaryIncome",
		};
	},

	describe({ label, params }) {
		const { fromAge, toAge } = params.window;
		const span =
			toAge === null ? `from age ${fromAge}` : `age ${fromAge}–${toAge}`;
		return `${label}: $${Math.round(params.annualAmount).toLocaleString()}/yr, ${span}.`;
	},

	compile({ draft, params, rule, ctx }) {
		if (params.annualAmount <= 0) return;
		draft.recurringIncome.push({
			label: rule.label,
			annualAmount: params.annualAmount,
			fromAge: params.window.fromAge,
			toAge: params.window.toAge ?? ctx.longevityAge,
			taxTreatment: params.taxTreatment,
			inflates: params.window.inflates,
			...(params.window.everyNYears != null && {
				everyNYears: params.window.everyNYears,
			}),
		});
	},
};
