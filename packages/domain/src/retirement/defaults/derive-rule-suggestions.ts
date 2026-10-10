import type { RetirementStandingRuleSuggestion } from "@moat/contracts";
import type { DetectedRecurringExpenseSignal } from "./signals";

/** Below this, a recurring charge is not worth a planning decision. */
const MINIMUM_MONTHLY_AMOUNT = 50;
/** Fewer observed months than this and the cadence is not established. */
const MINIMUM_OBSERVED_MONTHS = 4;
const MAX_SUGGESTIONS = 8;

/**
 * Turns detected recurring charges into suggestions the user can adopt.
 *
 * These are offered, never applied. A heuristic that silently added spending to
 * a projection would change the plan's answer based on a pattern the user never
 * confirmed — and "why did my retirement age move" would have no visible cause.
 */
export function deriveRecurringExpenseSuggestions(
	detected: DetectedRecurringExpenseSignal[],
	context: { retirementAge: number },
): RetirementStandingRuleSuggestion[] {
	return detected
		.filter(
			(expense) =>
				expense.monthlyAmount >= MINIMUM_MONTHLY_AMOUNT &&
				expense.observedMonths >= MINIMUM_OBSERVED_MONTHS,
		)
		.sort((a, b) => b.monthlyAmount - a.monthlyAmount)
		.slice(0, MAX_SUGGESTIONS)
		.map((expense) => ({
			key: expense.key,
			label: expense.label,
			rationale: `We noticed $${Math.round(expense.monthlyAmount).toLocaleString()}/mo for ${expense.label} — should this continue in retirement?`,
			rule: {
				kind: "RECURRING_EXPENSE" as const,
				params: {
					annualAmount: Math.round(expense.monthlyAmount * 12),
					window: {
						fromAge: context.retirementAge,
						toAge: null,
						inflates: true,
						everyNYears: null,
					},
					essentiality: "flexible" as const,
				},
			},
		}));
}
