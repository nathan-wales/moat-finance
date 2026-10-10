// Compiles singleton policies into `RetirementPlanInputs`.
//
// Track A wherever possible: if a rule's value is a function of age alone, it
// becomes an entry in an array the engine already reads, and the engine does not
// change. Only the contribution policy and the cash policy reach the year loop,
// because only they read a figure the engine computes that year.
//
// Every branch here is guarded so that an empty policy compiles to exactly the
// inputs the engine received before policies existed. That property is what
// lets the golden fixtures stay frozen.

import type { RetirementPolicies, SpendingPhase } from "@moat/contracts";
import {
	MEDICARE_AGE,
	stateIncomeTaxRate,
	stateRetirementTaxTreatment,
} from "./constants";
import { buildReturnSchedule } from "./glide-path";
import type {
	EnginePersonContributionPolicy,
	RetirementPlanInputs,
} from "./types";

export type PolicyCompileContext = {
	/** Effective wage withholding rate per person, from the gross-up. */
	primaryWageTaxRate: number;
	spouseWageTaxRate: number;
};

function toEnginePerson(
	person: RetirementPolicies["contribution"]["primary"],
	wageTaxRate: number,
): EnginePersonContributionPolicy {
	return {
		grossAnnualCompensation: person.grossAnnualCompensation?.value ?? 0,
		wageTaxRate,
		employerPlan: {
			mode: person.employerPlan.mode,
			amount: person.employerPlan.amount,
			rothShare: person.employerPlan.rothShare,
			match: person.employerPlan.match,
			profitSharingPercentOfSalary:
				person.employerPlan.profitSharingPercentOfSalary,
		},
		ira: {
			mode: person.ira.mode,
			amount: person.ira.amount,
			kind: person.ira.kind,
		},
		hsa: {
			mode: person.hsa.mode,
			employeeAmount: person.hsa.employeeAmount,
			employerAmount: person.hsa.employerAmount,
			coverage: person.hsa.coverage,
		},
		taxableMonthly: person.taxableMonthly,
	};
}

function personContributes(
	person: RetirementPolicies["contribution"]["primary"],
): boolean {
	return (
		person.employerPlan.mode !== "none" ||
		person.ira.mode !== "none" ||
		person.hsa.mode !== "none" ||
		person.taxableMonthly > 0
	);
}

function spendingStagesFromPhases(input: {
	phases: SpendingPhase[];
	baseMonthly: number;
}) {
	return input.phases.map((phase) => ({
		ageFrom: phase.fromAge,
		ageTo: phase.toAge,
		monthlyAmount: input.baseMonthly * phase.percentOfBase,
		label: phase.label,
	}));
}

/**
 * Folds policies into the baseline inputs. Pure and cloning, run before
 * `applyLevers` so a lever can still override anything a policy set.
 */
export function applyPolicies(
	inputs: RetirementPlanInputs,
	policies: RetirementPolicies,
	context: PolicyCompileContext,
): RetirementPlanInputs {
	const draft = structuredClone(inputs);

	applyContributionPolicy(draft, policies, context);
	applySpendingPolicy(draft, policies);
	applyHealthcarePolicy(draft, policies);
	applyTaxPolicy(draft, policies);
	applyCashPolicy(draft, policies);
	applyAllocationPolicy(draft, policies);

	return draft;
}

function applyContributionPolicy(
	draft: RetirementPlanInputs,
	policies: RetirementPolicies,
	context: PolicyCompileContext,
): void {
	const { contribution } = policies;
	const spouseActive =
		contribution.spouse !== null && personContributes(contribution.spouse);
	if (!personContributes(contribution.primary) && !spouseActive) return;

	draft.contributionPolicy = {
		primary: toEnginePerson(contribution.primary, context.primaryWageTaxRate),
		spouse: contribution.spouse
			? toEnginePerson(contribution.spouse, context.spouseWageTaxRate)
			: null,
		autoApplyCatchUp: contribution.autoApplyCatchUp,
		contributionsStopAge: contribution.contributionsStopAge,
	};
}

function applySpendingPolicy(
	draft: RetirementPlanInputs,
	policies: RetirementPolicies,
): void {
	const { spending } = policies;

	const percentOfCurrent = spending.retirementSpendPercentOfCurrent?.value;
	if (percentOfCurrent !== undefined && percentOfCurrent > 0) {
		const currentMonthly =
			spending.currentLifestyleMonthly?.value ??
			draft.preRetirementAnnualSpending / 12;
		draft.retirementMonthlySpending = currentMonthly * percentOfCurrent;
	}

	// Explicit stages from a lever or a saved plan outrank a generated curve;
	// this must not overwrite a schedule the user already chose.
	if (
		spending.phaseModel === "flat" ||
		spending.phases === null ||
		spending.phases.length === 0 ||
		draft.spendingStages.length > 0
	) {
		return;
	}

	draft.spendingStages = spendingStagesFromPhases({
		phases: spending.phases,
		baseMonthly: draft.retirementMonthlySpending,
	});
}

function healthcarePolicyIsActive(
	healthcare: RetirementPolicies["healthcare"],
): boolean {
	return (
		healthcare.preMedicareMonthlyPremium !== null ||
		healthcare.medicareMonthlyCost !== null ||
		healthcare.healthcareInflationPremium !== null
	);
}

function applyHealthcarePolicy(
	draft: RetirementPlanInputs,
	policies: RetirementPolicies,
): void {
	const { healthcare } = policies;
	// Empty `{}` columns parse to medicareStartAge: 65 with null premiums.
	// Compiling that would invent a pre-Medicare window on every un-migrated
	// plan. Only an actually populated policy may change the baseline.
	if (!healthcarePolicyIsActive(healthcare)) return;

	const preMedicarePremium = healthcare.preMedicareMonthlyPremium?.value;
	if (preMedicarePremium !== undefined) {
		draft.preMedicareMonthlyPremium = preMedicarePremium;
	}

	const medicareStartAge = healthcare.medicareStartAge ?? MEDICARE_AGE;
	draft.medicareStartAge = medicareStartAge;
	if (draft.preMedicareWindow === null && draft.preMedicareMonthlyPremium > 0) {
		draft.preMedicareWindow = {
			fromAge: draft.retirementAge,
			toAge: medicareStartAge - 1,
		};
	}

	const medicareCost = healthcare.medicareMonthlyCost?.value;
	if (medicareCost !== undefined && medicareCost > 0) {
		draft.medicareMonthlyCost = medicareCost;
	}

	const inflationPremium = healthcare.healthcareInflationPremium?.value;
	if (inflationPremium !== undefined) {
		draft.healthcareInflationPremium = inflationPremium;
	}
}

function applyTaxPolicy(
	draft: RetirementPlanInputs,
	policies: RetirementPolicies,
): void {
	const { tax } = policies;

	const currentState = tax.currentStateCode?.value ?? null;
	if (currentState) {
		draft.stateTaxRate = stateIncomeTaxRate(currentState, draft.stateTaxRate);
		if (tax.applyStateRetirementIncomeRules) {
			draft.stateRetirementTaxProfile =
				stateRetirementTaxTreatment(currentState);
		}
	}

	const retirementState = tax.retirementStateCode?.value ?? null;
	const changeAtAge = tax.stateChangeAtAge;
	if (retirementState && changeAtAge !== null) {
		draft.stateTaxChange = {
			atAge: changeAtAge,
			rate: stateIncomeTaxRate(retirementState, draft.stateTaxRate),
		};
		if (tax.applyStateRetirementIncomeRules) {
			draft.stateTaxChangeProfile =
				stateRetirementTaxTreatment(retirementState);
		}
	}

	const conversion = tax.rothConversion;
	if (conversion.mode === "none") return;
	const fromAge = conversion.fromAge ?? draft.retirementAge;
	const toAge = conversion.toAge ?? draft.rmdStartAge - 1;
	if (toAge < fromAge) return;

	draft.rothConversion = {
		fromAge,
		toAge,
		annualAmount:
			conversion.mode === "fixedAmount" ? conversion.annualAmount : null,
		fillToBracket:
			conversion.mode === "fillToBracket" ? conversion.targetBracket : null,
	};
}

function applyCashPolicy(
	draft: RetirementPlanInputs,
	policies: RetirementPolicies,
): void {
	// `cash` is today's locked residual-to-cash behavior, so leaving the policy
	// off the inputs keeps existing projections identical. Attach it only when
	// the user opted into a sweep (excess cash or RMD proceeds).
	if (
		policies.cash.excessDestination === "cash" &&
		policies.cash.rmdExcessDestination === "cash"
	) {
		return;
	}
	draft.cashPolicy = policies.cash;
}

function applyAllocationPolicy(
	draft: RetirementPlanInputs,
	policies: RetirementPolicies,
): void {
	const schedule = buildReturnSchedule({
		policy: policies.allocation,
		currentAge: draft.currentAge,
		retirementAge: draft.retirementAge,
		longevityAge: draft.longevityAge,
	});
	if (schedule) draft.returnSchedule = schedule;
}
