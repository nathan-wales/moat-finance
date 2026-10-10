import type { AnnuityRuleParams } from "@moat/contracts";
import type { StandingRuleModule } from "./types";

export const annuityRule: StandingRuleModule<"ANNUITY", AnnuityRuleParams> = {
	kind: "ANNUITY",

	defaultParams(ctx) {
		return {
			monthlyPayout: 0,
			startAge: Math.max(ctx.retirementAge, 65),
			premium: 0,
			hasCola: false,
		};
	},

	describe({ label, params }) {
		return `${label}: $${Math.round(params.monthlyPayout).toLocaleString()}/mo for life starting at age ${params.startAge}.`;
	},

	compile({ draft, params }) {
		if (params.monthlyPayout <= 0 && params.premium <= 0) return;
		draft.annuities.push({
			atAge: params.startAge,
			monthlyPayout: params.monthlyPayout,
			premium: params.premium,
			hasCola: params.hasCola,
		});
	},
};
