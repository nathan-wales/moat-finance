import type { RetirementPlanOverview } from "@moat/contracts";
import type { DefaultLeverContext } from "@moat/domain/retirement-levers";

export function defaultLeverContextFromOverview(
	overview: RetirementPlanOverview,
): DefaultLeverContext {
	return {
		currentAge: overview.plan.primaryCurrentAge,
		retirementAge: overview.plan.targetRetirementAge,
		spouseCurrentAge: overview.plan.spouseCurrentAge,
		spouseRetirementAge: overview.plan.spouseRetirementAge,
		hasSpouse: overview.plan.hasSpouse,
		annualEmploymentIncome: overview.baseline.annualEmploymentIncome,
		annualSpouseEmploymentIncome:
			overview.baseline.annualSpouseEmploymentIncome,
		expectedRetirementMonthlySpending:
			overview.baseline.expectedRetirementMonthlySpending,
		returnRate: overview.projection.assumptions.investmentReturnRate,
		socialSecurityClaimAge: overview.plan.socialSecurityClaimAge,
		spouseSocialSecurityClaimAge: overview.plan.spouseSocialSecurityClaimAge,
		rmdStartAge: overview.projection.assumptions.rmdStartAge,
		primaryPropertyId: null,
		rentalPropertyId: null,
	};
}
