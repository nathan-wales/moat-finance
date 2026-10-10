import type { PensionRuleParams } from "@moat/contracts";
import { primaryAgeFor, type StandingRuleModule } from "./types";

export const pensionRule: StandingRuleModule<"PENSION", PensionRuleParams> = {
	kind: "PENSION",

	defaultParams(ctx) {
		return {
			monthlyBenefit: 0,
			startAge: Math.max(ctx.retirementAge, 65),
			colaRate: 0,
			survivorPercent: 0.5,
			whom: "primary",
			taxTreatment: "ordinaryIncome",
		};
	},

	describe({ label, params }) {
		const cola =
			params.colaRate > 0
				? ` with a ${(params.colaRate * 100).toFixed(1)}% annual increase`
				: " with no cost-of-living increase";
		return `${label}: $${Math.round(params.monthlyBenefit).toLocaleString()}/mo from age ${params.startAge}${cola}.`;
	},

	compile({ draft, params, rule, ctx }) {
		if (params.monthlyBenefit <= 0) return;
		const fromAge = primaryAgeFor(ctx, params.whom, params.startAge);
		draft.recurringIncome.push({
			label: rule.label,
			annualAmount: params.monthlyBenefit * 12,
			fromAge,
			toAge: ctx.longevityAge,
			taxTreatment: params.taxTreatment,
			// A pension COLA is a contractual rate, not CPI. Riding general
			// inflation would silently make an un-indexed pension look inflation
			// protected.
			inflates: params.colaRate > 0,
			colaRate: params.colaRate,
			isRetirementIncome: true,
			dependsOn: params.whom,
			survivorShare: params.survivorPercent,
		});
	},
};
