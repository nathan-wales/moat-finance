import type { RetirementLever, RetirementLeverType } from "@moat/contracts";
import {
	ASSUMED_DOWN_PAYMENT_RATE,
	ASSUMED_MONTHLY_RENT_RATE,
	ASSUMED_MORTGAGE_RATE,
	ASSUMED_MORTGAGE_TERM_YEARS,
	ASSUMED_PROPERTY_EXPENSE_RATE,
	DEFAULT_LTC_MONTHLY_COST,
	DEFAULT_WITHDRAWAL_ORDER,
	MEDICARE_AGE,
} from "./constants";

export type DefaultLeverContext = {
	currentAge: number;
	retirementAge: number;
	spouseCurrentAge: number | null;
	spouseRetirementAge: number | null;
	hasSpouse: boolean;
	annualEmploymentIncome: number;
	annualSpouseEmploymentIncome: number;
	expectedRetirementMonthlySpending: number;
	returnRate: number;
	socialSecurityClaimAge: number;
	spouseSocialSecurityClaimAge: number | null;
	rmdStartAge: number;
	primaryPropertyId: string | null;
	rentalPropertyId: string | null;
};

function clampAge(age: number, min = 0, max = 200): number {
	return Math.min(max, Math.max(min, Math.round(age)));
}

function retirementAge(age: number): number {
	return clampAge(age);
}

function yearsFromNow(ctx: DefaultLeverContext, years: number): number {
	return clampAge(ctx.currentAge + years);
}

export function defaultLeverFor(
	type: RetirementLeverType,
	ctx: DefaultLeverContext,
): RetirementLever {
	const spouseAge = ctx.spouseCurrentAge ?? ctx.currentAge;
	const spouseRetire = ctx.spouseRetirementAge ?? ctx.retirementAge;
	const homePrice = 400_000;
	const downPayment = homePrice * ASSUMED_DOWN_PAYMENT_RATE;

	switch (type) {
		case "retire_earlier":
			return { type, params: { years: 2 } };
		case "retire_later":
			return { type, params: { years: 2 } };
		case "retire_at_age":
			return { type, params: { age: retirementAge(ctx.retirementAge) } };
		case "stop_working_at_age":
			return {
				type,
				params: { age: clampAge(ctx.currentAge) },
			};
		case "part_time_before_retirement":
			return {
				type,
				params: {
					annualIncome: Math.max(
						0,
						Math.round(ctx.annualEmploymentIncome * 0.5),
					),
					fromAge: clampAge(ctx.retirementAge - 5),
					toAge: clampAge(ctx.retirementAge),
				},
			};
		case "spouse_retire_at_age":
			return { type, params: { age: retirementAge(spouseRetire) } };
		case "spouse_stops_working":
			return {
				type,
				params: { atAge: clampAge(spouseAge) },
			};
		case "income_change":
			return {
				type,
				params: {
					annualDelta: -Math.round(ctx.annualEmploymentIncome),
					fromAge: ctx.currentAge,
					whom: "primary",
				},
			};
		case "job_loss":
			return {
				type,
				params: { atAge: ctx.currentAge, monthsOut: 6 },
			};
		case "career_break":
			return {
				type,
				params: {
					fromAge: ctx.currentAge,
					toAge: yearsFromNow(ctx, 2),
				},
			};
		case "annual_bonus":
			return {
				type,
				params: {
					amount: 10_000,
					fromAge: ctx.currentAge,
					toAge: ctx.retirementAge,
				},
			};
		case "side_business_income":
			return {
				type,
				params: {
					annualAmount: 25_000,
					fromAge: ctx.currentAge,
					toAge: ctx.retirementAge,
				},
			};
		case "rental_income_change":
			return {
				type,
				params: {
					propertyId: ctx.rentalPropertyId ?? undefined,
					monthlyAmount: 1_500,
					fromAge: ctx.currentAge,
				},
			};
		case "contribution_change":
			return { type, params: { monthlyDelta: 500 } };
		case "max_401k":
			return { type, params: { includeCatchUp: true } };
		case "max_roth_ira":
			return { type, params: { includeCatchUp: true } };
		case "max_spousal_iras":
			return { type, params: { includeCatchUp: true } };
		case "employer_match":
			return {
				type,
				params: { matchPercent: 0.5, upToPercentOfSalary: 0.06 },
			};
		case "max_hsa":
			return { type, params: { coverageType: "family" } };
		case "taxable_investing":
			return { type, params: { monthlyAmount: 500 } };
		case "stop_contributions_at_age":
			return { type, params: { age: clampAge(ctx.retirementAge) } };
		case "retirement_spending_change":
			return { type, params: { monthlyDelta: 1_000 } };
		case "retirement_spending_set":
			return {
				type,
				params: { monthlyAmount: ctx.expectedRetirementMonthlySpending },
			};
		case "retirement_spending_stages":
			return {
				type,
				params: {
					stages: [
						{
							ageFrom: ctx.retirementAge,
							ageTo: ctx.retirementAge + 10,
							monthlyAmount: ctx.expectedRetirementMonthlySpending,
							label: "Go-go years",
						},
					],
				},
			};
		case "spending_category_change":
			return {
				type,
				params: {
					label: "Kids",
					lineItemType: "expense",
					monthlyDelta: -500,
					matchKey: "expense:Kids",
					isRemoved: true,
					isNew: false,
				},
			};
		case "return_rate_delta":
			return { type, params: { delta: -0.01 } };
		case "return_rate_set":
			return { type, params: { rate: ctx.returnRate } };
		case "inflation_delta":
			return { type, params: { delta: 0.01 } };
		case "portfolio_shift":
			return { type, params: { target: "balanced" } };
		case "market_crash":
			return {
				type,
				params: {
					atAge: ctx.retirementAge,
					dropPercent: 0.3,
					recoveryYears: 3,
				},
			};
		case "sequence_risk":
			return { type, params: { years: 5, annualReturn: 0 } };
		case "social_security_claim_age":
			return { type, params: { age: ctx.socialSecurityClaimAge } };
		case "spouse_social_security_claim_age":
			return {
				type,
				params: { age: ctx.spouseSocialSecurityClaimAge ?? 67 },
			};
		case "social_security_haircut":
			return { type, params: { percent: 0.2 } };
		case "mortgage_payoff_early":
			return {
				type,
				params: {
					propertyId: ctx.primaryPropertyId ?? undefined,
					atAge: retirementAge(ctx.currentAge + 5),
				},
			};
		case "mortgage_extra_payment":
			return {
				type,
				params: {
					propertyId: ctx.primaryPropertyId ?? undefined,
					monthlyAmount: 500,
				},
			};
		case "mortgage_payoff_cancel":
			return {
				type,
				params: { propertyId: ctx.primaryPropertyId ?? undefined },
			};
		case "buy_home":
			return {
				type,
				params: {
					atAge: yearsFromNow(ctx, 5),
					price: homePrice,
					downPayment,
					rate: ASSUMED_MORTGAGE_RATE,
					termYears: ASSUMED_MORTGAGE_TERM_YEARS,
					usage: "PRIMARY_RESIDENCE",
				},
			};
		case "upsize_home":
			return {
				type,
				params: { atAge: yearsFromNow(ctx, 10), priceDelta: 150_000 },
			};
		case "downsize_home":
			return {
				type,
				params: {
					atAge: clampAge(70),
					newHomePrice: Math.round(homePrice * 0.6),
				},
			};
		case "sell_primary_home":
			return {
				type,
				params: { atAge: clampAge(70), thenRent: true },
			};
		case "rent_instead":
			return {
				type,
				params: {
					fromAge: ctx.currentAge,
					monthlyRent: Math.round(homePrice * ASSUMED_MONTHLY_RENT_RATE),
				},
			};
		case "add_rental_property":
			return {
				type,
				params: {
					atAge: yearsFromNow(ctx, 3),
					price: 300_000,
					downPayment: 300_000 * ASSUMED_DOWN_PAYMENT_RATE,
					monthlyRent: Math.round(300_000 * ASSUMED_MONTHLY_RENT_RATE),
					monthlyExpenses: Math.round(
						(300_000 * ASSUMED_PROPERTY_EXPENSE_RATE) / 12,
					),
				},
			};
		case "sell_rental_property":
			return {
				type,
				params: {
					propertyId: ctx.rentalPropertyId ?? undefined,
					atAge: clampAge(70),
				},
			};
		case "move_state":
			return {
				type,
				params: { atAge: ctx.retirementAge, stateCode: "FL" },
			};
		case "add_dependent":
			return {
				type,
				params: {
					atAge: ctx.currentAge,
					annualCost: 15_000,
					years: 5,
				},
			};
		case "fund_college":
			return {
				type,
				params: {
					startAge: yearsFromNow(ctx, 10),
					years: 4,
					annualCost: 35_000,
				},
			};
		case "charitable_gift":
			return {
				type,
				params: { amount: 10_000, atAge: ctx.retirementAge },
			};
		case "recurring_purchase":
			return {
				type,
				params: {
					amount: 40_000,
					fromAge: ctx.currentAge,
					toAge: clampAge(ctx.currentAge + 30),
					everyNYears: 8,
					label: "Car replacement",
				},
			};
		case "healthcare_cost_delta":
			return { type, params: { monthlyDelta: 300 } };
		case "pre_medicare_coverage":
			return {
				type,
				params: {
					monthlyPremium: 800,
					fromAge: ctx.retirementAge,
					toAge: MEDICARE_AGE,
				},
			};
		case "long_term_care_event":
			return {
				type,
				params: {
					atAge: clampAge(80),
					years: 3,
					monthlyCost: DEFAULT_LTC_MONTHLY_COST,
					whom: "primary",
				},
			};
		case "life_insurance_change":
			return { type, params: { deathBenefit: 500_000, remove: false } };
		case "policy_expires":
			return {
				type,
				params: { policyId: "policy", atAge: yearsFromNow(ctx, 10) },
			};
		case "ltc_policy_change":
			return {
				type,
				params: { monthlyBenefit: 6_000, remove: false },
			};
		case "annuity_begins":
			return {
				type,
				params: {
					atAge: ctx.retirementAge,
					monthlyPayout: 2_000,
					premium: 300_000,
					hasCola: false,
				},
			};
		case "disability_event":
			return {
				type,
				params: { atAge: ctx.currentAge, durationYears: 5 },
			};
		case "spouse_death":
			return { type, params: { atAge: clampAge(spouseAge + 20) } };
		case "roth_conversion":
			return {
				type,
				params: {
					fromAge: ctx.retirementAge,
					toAge: Math.max(ctx.retirementAge, ctx.rmdStartAge - 1),
					fillToBracket: 0.12,
				},
			};
		case "withdrawal_order":
			return { type, params: { order: [...DEFAULT_WITHDRAWAL_ORDER] } };
		case "custom_income":
			return {
				type,
				params: {
					amount: 50_000,
					cadence: "annual",
					fromAge: ctx.currentAge,
					toAge: ctx.retirementAge,
					taxTreatment: "taxable",
					label: "Custom income",
				},
			};
		case "custom_expense":
			return {
				type,
				params: {
					amount: 12_000,
					cadence: "annual",
					fromAge: ctx.retirementAge,
					toAge: clampAge(ctx.retirementAge + 20),
					essentiality: "flexible",
					label: "Custom expense",
				},
			};
		case "custom_one_time":
			return {
				type,
				params: {
					direction: "outflow",
					amount: 25_000,
					atAge: ctx.retirementAge,
					label: "One-time expense",
					taxTreatment: "taxable",
				},
			};
	}
}
