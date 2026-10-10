// One module per standing-rule kind, folded by `applyStandingRules`.
//
// Adding a kind means adding a contract union member and one file here. The
// parity test asserts every contract kind has a module, so drift is mechanical
// to catch rather than something a reviewer has to notice.

import type {
	RetirementStandingRule,
	RetirementStandingRuleBody,
	RetirementStandingRuleKind,
} from "@moat/contracts";
import type { RetirementPlanInputs } from "../types";
import { annuityRule } from "./annuity";
import { pensionRule } from "./pension";
import { recurringExpenseRule } from "./recurring-expense";
import { recurringIncomeRule } from "./recurring-income";
import type { StandingRuleContext } from "./types";

type AnyStandingRuleModule = {
	kind: RetirementStandingRuleKind;
	defaultParams(ctx: StandingRuleContext): unknown;
	describe(input: { label: string; params: never }): string;
	compile(input: {
		draft: RetirementPlanInputs;
		params: never;
		rule: RetirementStandingRule;
		ctx: StandingRuleContext;
	}): void;
};

const MODULES: Record<RetirementStandingRuleKind, AnyStandingRuleModule> = {
	PENSION: pensionRule as unknown as AnyStandingRuleModule,
	ANNUITY: annuityRule as unknown as AnyStandingRuleModule,
	RECURRING_INCOME: recurringIncomeRule as unknown as AnyStandingRuleModule,
	RECURRING_EXPENSE: recurringExpenseRule as unknown as AnyStandingRuleModule,
};

export function standingRuleKinds(): RetirementStandingRuleKind[] {
	return Object.keys(MODULES) as RetirementStandingRuleKind[];
}

export function hasStandingRuleModule(
	kind: RetirementStandingRuleKind,
): boolean {
	return kind in MODULES;
}

export function defaultStandingRuleBody(
	kind: RetirementStandingRuleKind,
	ctx: StandingRuleContext,
): RetirementStandingRuleBody {
	return {
		kind,
		params: MODULES[kind].defaultParams(ctx),
	} as RetirementStandingRuleBody;
}

export function describeStandingRule(rule: RetirementStandingRule): string {
	return MODULES[rule.rule.kind].describe({
		label: rule.label,
		params: rule.rule.params as never,
	});
}

export function compileStandingRule(input: {
	draft: RetirementPlanInputs;
	rule: RetirementStandingRule;
	ctx: StandingRuleContext;
}): void {
	MODULES[input.rule.rule.kind].compile({
		draft: input.draft,
		params: input.rule.rule.params as never,
		rule: input.rule,
		ctx: input.ctx,
	});
}
