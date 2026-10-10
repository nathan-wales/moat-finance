import { emptyPersonContributionPolicy } from "@moat/contracts";
import { grossUpNetIncome } from "../defaults/gross-up";
import type {
	EngineContributionPolicy,
	EnginePersonContributionPolicy,
	RetirementPlanInputs,
} from "../types";

function toEnginePerson(
	netIncome: number,
	inputs: RetirementPlanInputs,
): EnginePersonContributionPolicy {
	const empty = emptyPersonContributionPolicy();
	const grossed = grossUpNetIncome({
		netIncome,
		filingStatus: inputs.filingStatus,
		stateTaxRate: inputs.stateTaxRate,
	});
	return {
		grossAnnualCompensation: grossed.grossAnnualCompensation,
		wageTaxRate: grossed.wageTaxRate,
		employerPlan: {
			...empty.employerPlan,
			match: [...empty.employerPlan.match],
		},
		ira: {
			mode: empty.ira.mode,
			amount: empty.ira.amount,
			kind: empty.ira.kind,
		},
		hsa: {
			mode: empty.hsa.mode,
			employeeAmount: empty.hsa.employeeAmount,
			employerAmount: empty.hsa.employerAmount,
			coverage: empty.hsa.coverage,
		},
		taxableMonthly: 0,
	};
}

function seedPersonFromScalars(
	person: EnginePersonContributionPolicy,
	inputs: RetirementPlanInputs,
	whom: "primary" | "spouse",
): void {
	if (person.grossAnnualCompensation <= 0) {
		const net =
			whom === "primary"
				? inputs.annualEmploymentIncome
				: inputs.annualSpouseEmploymentIncome;
		const grossed = grossUpNetIncome({
			netIncome: net,
			filingStatus: inputs.filingStatus,
			stateTaxRate: inputs.stateTaxRate,
		});
		person.grossAnnualCompensation = grossed.grossAnnualCompensation;
		person.wageTaxRate = grossed.wageTaxRate;
	}
	if (whom === "primary" && person.employerPlan.mode === "none") {
		if (inputs.contributions.taxDeferred > 0) {
			person.employerPlan.mode = "fixedAnnual";
			person.employerPlan.amount = inputs.contributions.taxDeferred;
		}
		if (person.taxableMonthly <= 0 && inputs.contributions.taxable > 0) {
			person.taxableMonthly = inputs.contributions.taxable / 12;
		}
	}
}

/**
 * Contribution levers write the policy, not the frozen scalars. The first
 * lever that needs a policy clones one from today's scalars so a "max 401(k)"
 * what-if still sees the household's current deferral as the starting point.
 */
export function ensureContributionPolicy(
	inputs: RetirementPlanInputs,
): EngineContributionPolicy {
	if (inputs.contributionPolicy) return inputs.contributionPolicy;

	const primary = toEnginePerson(inputs.annualEmploymentIncome, inputs);
	seedPersonFromScalars(primary, inputs, "primary");

	const spouse =
		inputs.spouseCurrentAge === null
			? null
			: toEnginePerson(inputs.annualSpouseEmploymentIncome, inputs);

	const policy: EngineContributionPolicy = {
		primary,
		spouse,
		autoApplyCatchUp: true,
		contributionsStopAge:
			inputs.contributionsStopAge > 0 &&
			inputs.contributionsStopAge < inputs.longevityAge
				? inputs.contributionsStopAge
				: null,
	};
	inputs.contributionPolicy = policy;
	return policy;
}
