import type { RecurringExpenseRuleParams } from "@moat/contracts";
import type { StandingRuleModule } from "./types";

/**
 * The escape hatch on the spending side: travel budgets, tuition help, club
 * dues, a car every eight years. Amounts here are additive to the composed
 * living-expense figure and are never carved out of it, so they must describe
 * spending the trailing Insights window does not already contain.
 */
export const recurringExpenseRule: StandingRuleModule<
	"RECURRING_EXPENSE",
	RecurringExpenseRuleParams
> = {
	kind: "RECURRING_EXPENSE",

	defaultParams(ctx) {
		return {
			annualAmount: 0,
			window: {
				fromAge: ctx.retirementAge,
				toAge: null,
				inflates: true,
				everyNYears: null,
			},
			essentiality: "flexible",
		};
	},

	describe({ label, params }) {
		const { fromAge, toAge, everyNYears } = params.window;
		const span =
			toAge === null ? `from age ${fromAge}` : `age ${fromAge}–${toAge}`;
		const cadence =
			everyNYears != null && everyNYears > 1
				? ` every ${everyNYears} years`
				: "/yr";
		return `${label}: $${Math.round(params.annualAmount).toLocaleString()}${cadence}, ${span}.`;
	},

	compile({ draft, params, rule, ctx }) {
		if (params.annualAmount <= 0) return;
		draft.recurringExpenses.push({
			label: rule.label,
			annualAmount: params.annualAmount,
			fromAge: params.window.fromAge,
			toAge: params.window.toAge ?? ctx.longevityAge,
			essentiality: params.essentiality,
			inflates: params.window.inflates,
			...(params.window.everyNYears != null && {
				everyNYears: params.window.everyNYears,
			}),
		});
	},
};
