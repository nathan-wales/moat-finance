import type {
	RetirementStandingRule,
	RetirementStandingRuleKind,
} from "@moat/contracts";
import type { RetirementPlanInputs } from "../types";

/**
 * Everything a rule needs to translate its own ages into the primary-age
 * timeline the ledger indexes by. A spouse's pension starting at 65 is not the
 * same projection year as the primary's 65.
 */
export type StandingRuleContext = {
	currentAge: number;
	spouseCurrentAge: number | null;
	retirementAge: number;
	longevityAge: number;
};

/** Converts an age on one person's clock into the primary's age that year. */
export function primaryAgeFor(
	ctx: StandingRuleContext,
	whom: "primary" | "spouse",
	age: number,
): number {
	if (whom === "primary" || ctx.spouseCurrentAge === null) return age;
	return ctx.currentAge + (age - ctx.spouseCurrentAge);
}

export type StandingRuleModule<
	Kind extends RetirementStandingRuleKind,
	Params,
> = {
	kind: Kind;
	defaultParams(ctx: StandingRuleContext): Params;
	/** One sentence for the rule row. No PII, no amounts the UI won't show. */
	describe(input: { label: string; params: Params }): string;
	/**
	 * Folds the rule into the arrays `RetirementPlanInputs` already has. Track A
	 * only — a rule that needs a value the engine computes that year belongs in
	 * a policy, not here.
	 */
	compile(input: {
		draft: RetirementPlanInputs;
		params: Params;
		rule: RetirementStandingRule;
		ctx: StandingRuleContext;
	}): void;
};
