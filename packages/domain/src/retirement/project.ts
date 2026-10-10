// The deterministic year-by-year retirement ledger.
//
// Same inputs always produce the same outputs. Monte Carlo wraps this function
// with seeded return sequences; nothing in here reads a clock or a random
// number generator.

import type {
	RetirementMilestone,
	RetirementProjectionYear,
	RetirementSpendingStage,
} from "@moat/contracts";
import { amortizeMonth, amortizeYear } from "./amortize";
import {
	HEALTHCARE_INFLATION_PREMIUM,
	HOME_SALE_COST_RATE,
	MEDICARE_AGE,
	PRIMARY_RESIDENCE_GAIN_EXCLUSION,
} from "./constants";
import {
	applyYearEndGrowth,
	calculateCashFlowLeftover,
	calculateCashIn,
	calculateCashOut,
	calculateCashSweep,
	calculateHousing,
	calculateOtherDebtService,
	calculateWages,
	clipResolvedContributions,
	propertyLoanSchedule,
	resolveContributionPolicy,
	splitTaxableWithdrawal,
} from "./ledger";
import { toTodayDollars } from "./purchasing-power";
import { requiredMinimumDistribution } from "./rmd";
import {
	estimateBenefit,
	spousalMonthlyBenefit,
	survivorMonthlyBenefit,
} from "./social-security";
import { estimateAnnualTax, headroomToBracketTop } from "./taxes";
import type {
	ProjectedLiability,
	ProjectedProperty,
	RetirementBalances,
	RetirementPlanInputs,
} from "./types";
import { resolveWithdrawals } from "./withdrawal-order";

/** Share of a taxable-account withdrawal assumed to be realized gain. */
const TAXABLE_GAIN_FRACTION = 0.5;
/** Fixed-point iterations to settle the taxes ⇄ withdrawals feedback loop. */
const TAX_SOLVE_ITERATIONS = 4;

export type RetirementProjectionResult = {
	years: RetirementProjectionYear[];
	/** Today's balances, before year-end leftover and growth. */
	opening: RetirementProjectionYear;
	milestones: RetirementMilestone[];
	assetsAtRetirement: number;
	netWorthAtRetirement: number;
	legacyAtLongevity: number;
	lifetimeTaxes: number;
	lifetimeSocialSecurity: number;
	firstShortfallAge: number | null;
	fundedThroughLongevity: boolean;
	totalShortfall: number;
};

export function monthlySpendForAge(
	age: number,
	baseMonthly: number,
	stages: RetirementSpendingStage[],
): number {
	if (stages.length === 0) return baseMonthly;
	const ordered = [...stages].sort(
		(a, b) => a.ageFrom - b.ageFrom || (a.ageTo ?? 200) - (b.ageTo ?? 200),
	);
	let matched: number | null = null;
	for (const stage of ordered) {
		const to = stage.ageTo ?? Number.POSITIVE_INFINITY;
		if (age >= stage.ageFrom && age <= to) matched = stage.monthlyAmount;
	}
	return matched ?? baseMonthly;
}

function cloneProperty(property: ProjectedProperty): ProjectedProperty {
	return { ...property };
}

function cloneLiability(liability: ProjectedLiability): ProjectedLiability {
	return { ...liability };
}

function isOwnedAtOpen(
	property: ProjectedProperty,
	currentAge: number,
): boolean {
	const acquired =
		property.acquiredAtAge === null || property.acquiredAtAge < currentAge;
	const notSoldYet =
		property.sellAtAge === null || property.sellAtAge >= currentAge;
	return acquired && notSoldYet;
}

function ledgerSnapshot(input: {
	cashBalance: number;
	balances: RetirementBalances;
	ownedNow: ProjectedProperty[];
	liabilities: ProjectedLiability[];
}): Pick<
	RetirementProjectionYear,
	| "balanceTaxable"
	| "balanceTaxDeferred"
	| "balanceTaxFree"
	| "liquidAssets"
	| "realEstateEquity"
	| "debtBalance"
	| "netWorth"
	| "netWorthTodayDollars"
	| "liquidAssetsTodayDollars"
	| "cashBalance"
	| "otherDebt"
> {
	const cashBalance = Math.max(0, input.cashBalance);
	const realEstateEquity = input.ownedNow.reduce(
		(sum, property) => sum + Math.max(0, property.value - property.loanBalance),
		0,
	);
	const otherDebt = input.liabilities.reduce(
		(sum, liability) => sum + liability.balance,
		0,
	);
	const debtBalance =
		otherDebt +
		input.ownedNow.reduce((sum, property) => sum + property.loanBalance, 0);
	const liquidAssets =
		cashBalance +
		input.balances.taxable +
		input.balances.taxDeferred +
		input.balances.taxFree;
	const netWorth = liquidAssets + realEstateEquity - otherDebt;
	return {
		balanceTaxable: input.balances.taxable,
		balanceTaxDeferred: input.balances.taxDeferred,
		balanceTaxFree: input.balances.taxFree,
		liquidAssets,
		realEstateEquity,
		debtBalance,
		netWorth,
		netWorthTodayDollars: netWorth,
		liquidAssetsTodayDollars: liquidAssets,
		cashBalance,
		otherDebt,
	};
}

function buildOpeningYear(
	inputs: RetirementPlanInputs,
	cashBalance: number,
	balances: RetirementBalances,
	liabilities: ProjectedLiability[],
): RetirementProjectionYear {
	const spouseAlive =
		inputs.spouseCurrentAge !== null &&
		(inputs.spouseDeathAtAge === null ||
			inputs.currentAge < inputs.spouseDeathAtAge);
	const ownedNow = inputs.properties.filter((property) =>
		isOwnedAtOpen(property, inputs.currentAge),
	);
	const snapshot = ledgerSnapshot({
		cashBalance,
		balances,
		ownedNow,
		liabilities,
	});
	return {
		year: inputs.currentYear,
		age: inputs.currentAge,
		spouseAge: spouseAlive ? inputs.spouseCurrentAge : null,
		isRetired: inputs.currentAge >= inputs.retirementAge,
		employmentIncome: 0,
		spouseEmploymentIncome: 0,
		socialSecurityIncome: 0,
		spouseSocialSecurityIncome: 0,
		rentalIncome: 0,
		otherIncome: 0,
		insuranceIncome: 0,
		oneTimeInflows: 0,
		grossIncome: 0,
		contributionsTaxable: 0,
		contributionsTaxDeferred: 0,
		contributionsTaxFree: 0,
		contributionsCash: 0,
		employerContributions: 0,
		employeeDeferral: 0,
		cashFlowLeftover: 0,
		cashFlowTax: 0,
		withdrawalsTaxable: 0,
		withdrawalsTaxDeferred: 0,
		withdrawalsTaxFree: 0,
		requiredMinimumDistribution: 0,
		rothConversion: 0,
		livingExpenses: 0,
		essentialExpenses: 0,
		flexibleExpenses: 0,
		healthcareExpenses: 0,
		housingExpenses: 0,
		oneTimeExpenses: 0,
		insurancePremiums: 0,
		totalOutflow: 0,
		taxableIncome: 0,
		taxesPaid: 0,
		marginalRate: 0,
		effectiveRate: 0,
		spendableIncome: 0,
		shortfall: 0,
		inflationFactor: 1,
		...snapshot,
	};
}

function resolveLiabilities(
	inputs: RetirementPlanInputs,
): ProjectedLiability[] {
	if (inputs.liabilities !== undefined && inputs.liabilities.length > 0) {
		return inputs.liabilities.map(cloneLiability);
	}
	const otherDebt = Math.max(0, inputs.otherDebt ?? 0);
	if (otherDebt <= 0) return [];
	return [
		{
			id: "other-debt",
			name: "Other debt",
			balance: otherDebt,
			annualInterestRate: 0,
			monthlyPayment: 0,
			remainingTermMonths: 0,
		},
	];
}

/** Advances one property by twelve months of amortization and appreciation. */
function stepProperty(property: ProjectedProperty): void {
	if (property.loanBalance > 0) {
		const stepped = amortizeYear(propertyLoanSchedule(property));
		property.loanBalance = stepped.balance;
		property.remainingTermMonths = stepped.remainingTermMonths;
	}
	property.value *= 1 + property.appreciationRate;
}

function stepLiability(liability: ProjectedLiability): void {
	const monthlyPayment =
		liability.monthlyPayment + (liability.extraMonthlyPayment ?? 0);
	const stepped = amortizeYear({
		balance: liability.balance,
		annualInterestRate: liability.annualInterestRate,
		monthlyPayment,
		remainingTermMonths: liability.remainingTermMonths,
	});
	liability.balance = stepped.balance;
	liability.remainingTermMonths = stepped.remainingTermMonths;
}

function recurringAmountForAge(
	flow: {
		annualAmount: number;
		fromAge: number;
		toAge: number;
		everyNYears?: number;
		inflates?: boolean;
		colaRate?: number;
	},
	age: number,
	inflationFactor: number,
): number {
	if (age < flow.fromAge || age > flow.toAge) return 0;
	if (flow.everyNYears && flow.everyNYears > 1) {
		if ((age - flow.fromAge) % flow.everyNYears !== 0) return 0;
	}
	const yearsOn = age - flow.fromAge;
	if (flow.colaRate !== undefined && flow.colaRate > 0) {
		return flow.annualAmount * (1 + flow.colaRate) ** yearsOn;
	}
	const inflates = flow.inflates !== false;
	return flow.annualAmount * (inflates ? inflationFactor : 1);
}

export function projectRetirement(
	inputs: RetirementPlanInputs,
): RetirementProjectionResult {
	const years: RetirementProjectionYear[] = [];
	const { cash: startingCash = 0, ...startingInvestable } = inputs.balances;
	const balances: RetirementBalances = { ...startingInvestable };
	let cashBalance = Math.max(0, startingCash);
	let properties = inputs.properties.map(cloneProperty);
	const liabilities = resolveLiabilities(inputs);
	const opening = buildOpeningYear(inputs, cashBalance, balances, liabilities);
	const contributionGrowthRate =
		inputs.contributionGrowthRate ?? inputs.incomeGrowthRate;
	const expenseGrowthRate = inputs.expenseGrowthRate ?? inputs.inflationRate;

	let lifetimeTaxes = 0;
	let lifetimeSocialSecurity = 0;
	let firstShortfallAge: number | null = null;
	let totalShortfall = 0;
	let assetsAtRetirement = 0;
	let netWorthAtRetirement = 0;
	const rentingFromAge: number | null = inputs.rentFromAge;
	const monthlyRentAfterSale = inputs.monthlyRentAfterHomeSale;
	let stateTaxRate = inputs.stateTaxRate;
	let stateRetirementTaxProfile = inputs.stateRetirementTaxProfile ?? null;

	const horizonYears = Math.max(0, inputs.longevityAge - inputs.currentAge);

	for (let yearIndex = 0; yearIndex <= horizonYears; yearIndex++) {
		const age = inputs.currentAge + yearIndex;
		const calendarYear = inputs.currentYear + yearIndex;
		const inflationFactor = (1 + inputs.inflationRate) ** yearIndex;
		const salaryFactor = (1 + inputs.incomeGrowthRate) ** yearIndex;
		const contributionFactor = (1 + contributionGrowthRate) ** yearIndex;
		const expenseFactor = (1 + expenseGrowthRate) ** yearIndex;
		const healthcareFactor =
			(1 +
				inputs.inflationRate +
				(inputs.healthcareInflationPremium ?? HEALTHCARE_INFLATION_PREMIUM)) **
			yearIndex;

		const spouseAge =
			inputs.spouseCurrentAge !== null
				? inputs.spouseCurrentAge + yearIndex
				: null;
		const spouseAlive =
			spouseAge !== null &&
			(inputs.spouseDeathAtAge === null || age < inputs.spouseDeathAtAge);

		if (inputs.stateTaxChange !== null && age >= inputs.stateTaxChange.atAge) {
			stateTaxRate = inputs.stateTaxChange.rate;
			if (inputs.stateTaxChangeProfile !== undefined) {
				stateRetirementTaxProfile = inputs.stateTaxChangeProfile;
			}
		}

		const filingStatus =
			inputs.filingStatus === "marriedJoint" && !spouseAlive
				? "single"
				: inputs.filingStatus;

		const isRetired = age >= inputs.retirementAge;

		// ─── Employment income ────────────────────────────────────────────────
		const wages = calculateWages({
			age,
			spouseAge,
			spouseAlive,
			salaryFactor,
			inflationFactor,
			annualEmploymentIncome: inputs.annualEmploymentIncome,
			annualSpouseEmploymentIncome: inputs.annualSpouseEmploymentIncome,
			employmentEndsAtAge: inputs.employmentEndsAtAge,
			spouseEmploymentEndsAtAge: inputs.spouseEmploymentEndsAtAge,
			incomeAdjustments: inputs.incomeAdjustments,
			incomeGaps: inputs.incomeGaps,
		});
		let employmentIncome = wages.employmentIncome;
		const spouseEmploymentIncome = wages.spouseEmploymentIncome;
		const severanceIncome = wages.severanceIncome;

		// ─── Social Security ──────────────────────────────────────────────────
		const spouseSsInputs = inputs.spouseSocialSecurity;
		const higherEarnerMonthlyAtFra = Math.max(
			inputs.socialSecurity.monthlyAtFra,
			spouseSsInputs?.monthlyAtFra ?? 0,
		);
		const primaryMonthlyBenefit =
			age >= inputs.socialSecurity.claimAge
				? spousalMonthlyBenefit({
						ownMonthlyAtFra: inputs.socialSecurity.monthlyAtFra,
						higherEarnerMonthlyAtFra,
						claimAge: inputs.socialSecurity.claimAge,
					}) *
					(1 - inputs.socialSecurity.haircut)
				: 0;

		const spouseMonthlyBenefitRaw =
			spouseSsInputs !== null &&
			spouseAge !== null &&
			spouseAge >= spouseSsInputs.claimAge
				? spousalMonthlyBenefit({
						ownMonthlyAtFra: spouseSsInputs.monthlyAtFra,
						higherEarnerMonthlyAtFra,
						claimAge: spouseSsInputs.claimAge,
					}) *
					(1 - spouseSsInputs.haircut)
				: 0;

		let socialSecurityMonthly = primaryMonthlyBenefit;
		let spouseSocialSecurityMonthly = spouseAlive ? spouseMonthlyBenefitRaw : 0;
		if (!spouseAlive && spouseSsInputs !== null) {
			const deceasedMonthly =
				spouseMonthlyBenefitRaw > 0
					? spouseMonthlyBenefitRaw
					: estimateBenefit({
							monthlyAtFra: spouseSsInputs.monthlyAtFra,
							claimAge: spouseSsInputs.claimAge,
						}) *
						(1 - spouseSsInputs.haircut);
			socialSecurityMonthly = survivorMonthlyBenefit({
				primaryMonthly: primaryMonthlyBenefit,
				spouseMonthly: deceasedMonthly,
			});
			spouseSocialSecurityMonthly = 0;
		}

		// FRA amounts are in today's dollars; inflate with the rest of the
		// nominal ledger so benefits keep pace with spending.
		const socialSecurityIncome = socialSecurityMonthly * 12 * inflationFactor;
		const spouseSocialSecurityIncome =
			spouseSocialSecurityMonthly * 12 * inflationFactor;
		lifetimeSocialSecurity += socialSecurityIncome + spouseSocialSecurityIncome;

		// ─── Property acquisition / disposal ──────────────────────────────────
		let oneTimeInflows = 0;
		let oneTimeOutflows = 0;
		let capitalGainsFromSale = 0;

		const stillOwned: ProjectedProperty[] = [];
		for (const property of properties) {
			if (property.acquiredAtAge !== null && age < property.acquiredAtAge) {
				stillOwned.push(property);
				continue;
			}
			if (property.acquiredAtAge === age) {
				oneTimeOutflows += property.downPayment;
			}
			if (property.sellAtAge !== null && age === property.sellAtAge) {
				const grossProceeds = property.value * (1 - HOME_SALE_COST_RATE);
				const netProceeds = Math.max(0, grossProceeds - property.loanBalance);
				oneTimeInflows += netProceeds;
				if (property.isPrimaryResidence) {
					const exclusion = PRIMARY_RESIDENCE_GAIN_EXCLUSION[filingStatus];
					const taxableGain = Math.max(
						0,
						grossProceeds - property.costBasis - exclusion,
					);
					capitalGainsFromSale += taxableGain;
				} else {
					const taxableGain = Math.max(
						0,
						(grossProceeds - property.costBasis) * TAXABLE_GAIN_FRACTION,
					);
					capitalGainsFromSale += taxableGain;
				}
				continue;
			}
			stillOwned.push(property);
		}
		properties = stillOwned;

		const ownedNow = properties.filter(
			(property) =>
				property.acquiredAtAge === null || age >= property.acquiredAtAge,
		);

		const ownsPrimaryResidence = ownedNow.some(
			(property) => property.isPrimaryResidence,
		);
		const { rentalIncome, housingExpenses } = calculateHousing({
			ownedNow,
			yearIndex,
			inflationFactor,
			age,
			rentingFromAge,
			monthlyRentAfterSale,
			ownsPrimaryResidence,
		});

		// ─── Other income ─────────────────────────────────────────────────────
		let otherIncome = severanceIncome;
		let ordinaryOtherIncome = severanceIncome;
		let pensionOrdinaryIncome = 0;
		for (const flow of inputs.recurringIncome) {
			let amount = recurringAmountForAge(flow, age, inflationFactor);
			if (amount === 0) continue;
			// A survivor percentage only bites once the person the benefit is
			// written on has died.
			if (
				flow.dependsOn === "spouse" &&
				!spouseAlive &&
				flow.survivorShare !== undefined
			) {
				amount *= flow.survivorShare;
			}
			otherIncome += amount;
			if (flow.taxTreatment !== "taxFree") {
				ordinaryOtherIncome += amount;
				if (flow.isRetirementIncome) pensionOrdinaryIncome += amount;
			}
		}
		for (const annuity of inputs.annuities) {
			if (age < annuity.atAge) continue;
			if (age === annuity.atAge) oneTimeOutflows += annuity.premium;
			const colaFactor = annuity.hasCola
				? (1 + inputs.inflationRate) ** (age - annuity.atAge)
				: 1;
			const payout = annuity.monthlyPayout * 12 * colaFactor;
			otherIncome += payout;
			ordinaryOtherIncome += payout;
			pensionOrdinaryIncome += payout;
		}

		let insuranceIncome = 0;
		for (const event of inputs.disabilityEvents) {
			if (age < event.atAge || age >= event.atAge + event.durationYears) {
				continue;
			}
			const benefit = event.monthlyBenefit * 12 * inflationFactor;
			insuranceIncome += benefit;
			ordinaryOtherIncome += benefit;
			// A disability event stops earned income for its duration.
			employmentIncome = 0;
		}

		// ─── Long-term care ───────────────────────────────────────────────────
		let longTermCareCost = 0;
		for (const event of inputs.longTermCareEvents) {
			if (age < event.atAge || age >= event.atAge + event.years) continue;
			const people = event.whom === "both" ? 2 : 1;
			const grossCost =
				event.monthlyCost * 12 * people * (inflationFactor || 1);
			let covered = 0;
			const coverage = inputs.ltcCoverage;
			if (
				coverage &&
				(coverage.expiresAtAge === null || age < coverage.expiresAtAge)
			) {
				const yearsElapsed = age - event.atAge;
				const eliminationYears = coverage.eliminationDays / 365;
				const coveredYearStart = Math.max(0, yearsElapsed - eliminationYears);
				if (
					yearsElapsed + 1 > eliminationYears &&
					coveredYearStart < coverage.benefitYears
				) {
					const coverageFactor = coverage.hasInflationProtection
						? inflationFactor
						: 1;
					const monthsCovered = Math.min(
						12,
						Math.max(0, (coverage.benefitYears - coveredYearStart) * 12),
					);
					covered = Math.min(
						grossCost,
						coverage.monthlyBenefit * monthsCovered * people * coverageFactor,
					);
				}
			}
			longTermCareCost += Math.max(0, grossCost - covered);
		}

		// ─── Life insurance payout ────────────────────────────────────────────
		if (inputs.spouseDeathAtAge !== null && age === inputs.spouseDeathAtAge) {
			for (const policy of inputs.lifeCoverage) {
				if (policy.insured !== "spouse") continue;
				if (policy.expiresAtAge !== null && age >= policy.expiresAtAge) {
					continue;
				}
				oneTimeInflows += policy.deathBenefit;
			}
		}

		// ─── Insurance premiums ───────────────────────────────────────────────
		let insurancePremiums = 0;
		for (const premium of inputs.insurancePremiums) {
			if (premium.expiresAtAge !== null && age >= premium.expiresAtAge) {
				continue;
			}
			insurancePremiums += premium.annualPremium * inflationFactor;
		}
		for (const policy of inputs.lifeCoverage) {
			if (policy.expiresAtAge !== null && age >= policy.expiresAtAge) continue;
			insurancePremiums += policy.annualPremium * inflationFactor;
		}

		// ─── One-time events ──────────────────────────────────────────────────
		let oneTimeOrdinaryIncome = 0;
		for (const event of inputs.oneTimeEvents) {
			if (event.atAge !== age) continue;
			if (event.direction === "inflow") {
				oneTimeInflows += event.amount;
				if (event.taxTreatment === "ordinaryIncome") {
					oneTimeOrdinaryIncome += event.amount;
				} else if (event.taxTreatment === "taxable") {
					capitalGainsFromSale += event.amount * TAXABLE_GAIN_FRACTION;
				}
			} else {
				oneTimeOutflows += event.amount;
			}
		}

		// ─── Living expenses ──────────────────────────────────────────────────
		const baseMonthlyRetirementSpend = monthlySpendForAge(
			age,
			inputs.retirementMonthlySpending,
			inputs.spendingStages,
		);
		const livingExpenses = isRetired
			? baseMonthlyRetirementSpend * 12 * expenseFactor
			: inputs.preRetirementAnnualSpending * expenseFactor;

		let healthcareExpenses = isRetired
			? inputs.annualHealthcareSpending *
				healthcareFactor *
				inputs.healthcareCostMultiplier
			: inputs.preRetirementAnnualHealthcare * inflationFactor;
		const medicareStartAge = inputs.medicareStartAge ?? MEDICARE_AGE;
		const preMedicare = inputs.preMedicareWindow;
		const coveredAdults = spouseAlive ? 2 : 1;
		const inPreMedicareWindow =
			preMedicare !== null
				? age >= preMedicare.fromAge && age <= preMedicare.toAge
				: isRetired && age < medicareStartAge;
		if (inPreMedicareWindow) {
			healthcareExpenses +=
				inputs.preMedicareMonthlyPremium *
				12 *
				coveredAdults *
				healthcareFactor;
		}
		// Medicare is not free. Reverting to the household's general healthcare
		// figure at 65 quietly drops Part B, Part D and supplemental premiums.
		if (age >= medicareStartAge && (inputs.medicareMonthlyCost ?? 0) > 0) {
			healthcareExpenses +=
				(inputs.medicareMonthlyCost ?? 0) *
				12 *
				coveredAdults *
				healthcareFactor;
		}
		healthcareExpenses += longTermCareCost;

		let recurringExpenseTotal = 0;
		let essentialRecurring = 0;
		for (const flow of inputs.recurringExpenses) {
			const amount = recurringAmountForAge(flow, age, inflationFactor);
			if (amount === 0) continue;
			recurringExpenseTotal += amount;
			if (flow.essentiality === "essential") essentialRecurring += amount;
		}

		// ─── Contributions ────────────────────────────────────────────────────
		// Without a policy, household contributions still die with the primary's
		// job — the historical gate. With a policy, each person contributes
		// while that person works; leftover only decides whether the household
		// can fund the employee share.
		const householdEarning = employmentIncome + spouseEmploymentIncome > 0;
		const contributing = inputs.contributionPolicy
			? (inputs.contributionPolicy.contributionsStopAge === null ||
					age < inputs.contributionPolicy.contributionsStopAge) &&
				householdEarning
			: age <
					Math.min(inputs.contributionsStopAge, inputs.employmentEndsAtAge) &&
				householdEarning;
		const resolvedContributions = inputs.contributionPolicy
			? resolveContributionPolicy({
					policy: inputs.contributionPolicy,
					age,
					spouseAge,
					primaryWorking: employmentIncome > 0,
					spouseWorking: spouseEmploymentIncome > 0,
					taxYear: calendarYear,
					inflationRate: inputs.inflationRate,
					primaryGrossSalary:
						inputs.contributionPolicy.primary.grossAnnualCompensation *
						salaryFactor,
					spouseGrossSalary: inputs.contributionPolicy.spouse
						? inputs.contributionPolicy.spouse.grossAnnualCompensation *
							salaryFactor
						: undefined,
				})
			: null;
		const plannedContributions = resolvedContributions ?? {
			taxDeferred: {
				amount: inputs.contributions.taxDeferred * contributionFactor,
				cashCost: inputs.contributions.taxDeferred * contributionFactor,
			},
			taxFree: {
				amount: inputs.contributions.taxFree * contributionFactor,
				cashCost: inputs.contributions.taxFree * contributionFactor,
			},
			taxable: {
				amount: inputs.contributions.taxable * contributionFactor,
				cashCost: inputs.contributions.taxable * contributionFactor,
			},
			employerTaxDeferred: 0,
			employeeDeferral: 0,
		};
		// ─── Required minimum distribution ────────────────────────────────────
		const rmd = requiredMinimumDistribution({
			age,
			balance: balances.taxDeferred,
			rmdStartAge: inputs.rmdStartAge,
		});

		// ─── Roth conversion ──────────────────────────────────────────────────
		let rothConversion = 0;
		const conversionPlan = inputs.rothConversion;

		// ─── Solve taxes ⇄ withdrawals ────────────────────────────────────────
		const cashIn = calculateCashIn({
			employmentIncome,
			spouseEmploymentIncome,
			socialSecurityIncome,
			spouseSocialSecurityIncome,
			rentalIncome,
			otherIncome,
			insuranceIncome,
			oneTimeInflows,
		});

		const otherDebtService = calculateOtherDebtService(liabilities);
		const cashOut = calculateCashOut({
			livingExpenses,
			housingExpenses,
			healthcareExpenses,
			recurringExpenseTotal,
			insurancePremiums,
			oneTimeOutflows,
			otherDebtService,
		});

		let withdrawal = resolveWithdrawals({
			need: 0,
			balances,
			order: inputs.withdrawalOrder,
		});
		let taxResult = estimateAnnualTax({
			ordinaryIncome: 0,
			capitalGains: 0,
			socialSecurityBenefit: 0,
			filingStatus,
			stateTaxRate,
			primaryAge: age,
			spouseAge: spouseAlive ? spouseAge : null,
			taxYear: calendarYear,
			inflationRate: inputs.inflationRate,
		});

		let cashFlowLeftover = 0;

		const settleTaxes = (): void => {
			// During accumulation, trailing INCOME is after-tax bank deposits
			// (Insights). Do not levy income tax on it again for cash flow. Tax
			// only withdrawals, RMDs, Roth conversions, and realized gains.
			const taxDeferredDraw = Math.max(rmd, withdrawal.taxDeferred);
			const ordinaryForCashFlow = isRetired
				? employmentIncome +
					spouseEmploymentIncome +
					rentalIncome +
					ordinaryOtherIncome +
					oneTimeOrdinaryIncome +
					taxDeferredDraw +
					rothConversion
				: ordinaryOtherIncome +
					oneTimeOrdinaryIncome +
					taxDeferredDraw +
					rothConversion;
			const taxableSplit = splitTaxableWithdrawal(
				withdrawal.taxable,
				cashBalance,
			);
			taxResult = estimateAnnualTax({
				ordinaryIncome: ordinaryForCashFlow,
				capitalGains:
					taxableSplit.brokerage * TAXABLE_GAIN_FRACTION + capitalGainsFromSale,
				socialSecurityBenefit:
					socialSecurityIncome + spouseSocialSecurityIncome,
				filingStatus,
				stateTaxRate,
				stateRetirementTaxProfile,
				retirementOrdinaryIncome:
					taxDeferredDraw + rothConversion + pensionOrdinaryIncome,
				primaryAge: age,
				spouseAge: spouseAlive ? spouseAge : null,
				taxYear: calendarYear,
				inflationRate: inputs.inflationRate,
			});

			// Signed leftover: same identity in accumulation and retirement.
			cashFlowLeftover = calculateCashFlowLeftover({
				cashIn,
				cashOut,
				cashFlowTax: taxResult.totalTax,
			});
			const needFromPortfolio =
				cashFlowLeftover < 0 ? Math.max(0, -cashFlowLeftover - rmd) : 0;
			const additional = resolveWithdrawals({
				need: needFromPortfolio,
				balances: {
					taxable: cashBalance + balances.taxable,
					taxDeferred: Math.max(0, balances.taxDeferred - rmd),
					taxFree: balances.taxFree,
				},
				order: inputs.withdrawalOrder,
			});
			withdrawal = {
				taxable: additional.taxable,
				taxDeferred: additional.taxDeferred + rmd,
				taxFree: additional.taxFree,
				total: additional.total + rmd,
				unmet: additional.unmet,
			};
		};

		for (let iteration = 0; iteration < TAX_SOLVE_ITERATIONS; iteration++) {
			settleTaxes();
			if (
				conversionPlan &&
				age >= conversionPlan.fromAge &&
				age <= conversionPlan.toAge
			) {
				const available = Math.max(
					0,
					balances.taxDeferred - Math.max(rmd, withdrawal.taxDeferred),
				);
				if (conversionPlan.annualAmount !== null) {
					rothConversion = Math.min(conversionPlan.annualAmount, available);
				} else if (conversionPlan.fillToBracket !== null) {
					const headroom = headroomToBracketTop({
						taxableIncome: taxResult.taxableIncome,
						filingStatus,
						taxYear: calendarYear,
						inflationRate: inputs.inflationRate,
						targetRate: conversionPlan.fillToBracket,
					});
					rothConversion = Math.min(headroom, available);
				}
			}
		}
		settleTaxes();

		// Display tax includes wages/rental every year so the Taxes chart is
		// honest. Cash-flow tax above still skips them during accumulation.
		const displayTaxResult = isRetired
			? taxResult
			: estimateAnnualTax({
					ordinaryIncome:
						employmentIncome +
						spouseEmploymentIncome +
						rentalIncome +
						ordinaryOtherIncome +
						oneTimeOrdinaryIncome +
						Math.max(rmd, withdrawal.taxDeferred) +
						rothConversion,
					capitalGains:
						splitTaxableWithdrawal(withdrawal.taxable, cashBalance).brokerage *
							TAXABLE_GAIN_FRACTION +
						capitalGainsFromSale,
					socialSecurityBenefit:
						socialSecurityIncome + spouseSocialSecurityIncome,
					filingStatus,
					stateTaxRate,
					primaryAge: age,
					spouseAge: spouseAlive ? spouseAge : null,
					taxYear: calendarYear,
					inflationRate: inputs.inflationRate,
				});

		lifetimeTaxes += displayTaxResult.totalTax;

		if (withdrawal.unmet > 0.5) {
			totalShortfall += withdrawal.unmet;
			if (firstShortfallAge === null) firstShortfallAge = age;
		}

		// ─── Move money ───────────────────────────────────────────────────────
		const taxableSplit = splitTaxableWithdrawal(
			withdrawal.taxable,
			cashBalance,
		);
		cashBalance = Math.max(0, cashBalance - taxableSplit.cash);
		balances.taxable = Math.max(0, balances.taxable - taxableSplit.brokerage);
		balances.taxDeferred = Math.max(
			0,
			balances.taxDeferred - withdrawal.taxDeferred,
		);
		balances.taxFree = Math.max(0, balances.taxFree - withdrawal.taxFree);

		if (rothConversion > 0) {
			const moved = Math.min(rothConversion, balances.taxDeferred);
			balances.taxDeferred -= moved;
			balances.taxFree += moved;
			rothConversion = moved;
		}

		const clipped = clipResolvedContributions({
			resolved: plannedContributions,
			leftover: cashFlowLeftover,
			contributing,
		});
		const recordedContributionsTaxDeferred = clipped.taxDeferred;
		const recordedContributionsTaxFree = clipped.taxFree;
		const recordedContributionsTaxable = clipped.taxable;
		const recordedContributionsCash = clipped.residual;

		balances.taxDeferred += clipped.taxDeferred;
		balances.taxFree += clipped.taxFree;
		balances.taxable += clipped.taxable;
		// Employer money is a balance addition and nothing else. It never entered
		// the household's bank account, so charging it against take-home leftover
		// would make free money look like a cost. Match still scales with the
		// funded employee deferral — an unfunded 401(k) does not attract a match.
		const employeeCashCost =
			plannedContributions.taxDeferred.cashCost +
			plannedContributions.taxFree.cashCost +
			plannedContributions.taxable.cashCost;
		const fundedEmployeeShare =
			employeeCashCost <= 0
				? contributing
					? 1
					: 0
				: cashFlowLeftover <= 0
					? 0
					: Math.min(1, cashFlowLeftover / employeeCashCost);
		const employerContributions =
			plannedContributions.employerTaxDeferred * fundedEmployeeShare;
		balances.taxDeferred += employerContributions;
		// Park leftover after planned contribs. Include forced withdrawals (RMD)
		// so dollars leaving deferred still land in cash when leftover >= 0;
		// when leftover < 0, leftover + withdrawal.total is ~0 and we add nothing.
		cashBalance += Math.max(
			0,
			cashFlowLeftover + withdrawal.total - clipped.cashSpent,
		);

		const sweep = calculateCashSweep({
			policy: inputs.cashPolicy,
			endingCash: cashBalance,
			annualExpenses: cashOut,
			rmdAmount: rmd,
		});
		cashBalance = sweep.remainingCash;
		balances.taxable += sweep.sweptToTaxable;

		const grown = applyYearEndGrowth({
			cashBalance,
			balances,
			cashYield: inputs.cashYield,
			inputs,
			yearIndex,
			age,
		});
		cashBalance = grown.cashBalance;
		balances.taxable = grown.balances.taxable;
		balances.taxDeferred = grown.balances.taxDeferred;
		balances.taxFree = grown.balances.taxFree;

		for (const property of ownedNow) stepProperty(property);
		for (const liability of liabilities) stepLiability(liability);

		const snapshot = ledgerSnapshot({
			cashBalance,
			balances,
			ownedNow,
			liabilities,
		});
		const { liquidAssets, netWorth } = snapshot;

		if (age === inputs.retirementAge) {
			assetsAtRetirement = liquidAssets;
			netWorthAtRetirement = netWorth;
		}

		const grossIncome =
			employmentIncome +
			spouseEmploymentIncome +
			socialSecurityIncome +
			spouseSocialSecurityIncome +
			rentalIncome +
			otherIncome +
			insuranceIncome +
			oneTimeInflows +
			withdrawal.total;

		const totalOutflow = cashOut;

		years.push({
			year: calendarYear,
			age,
			spouseAge: spouseAlive ? spouseAge : null,
			isRetired,
			employmentIncome,
			spouseEmploymentIncome,
			socialSecurityIncome,
			spouseSocialSecurityIncome,
			rentalIncome,
			otherIncome,
			insuranceIncome,
			oneTimeInflows,
			grossIncome,
			contributionsTaxable: recordedContributionsTaxable,
			contributionsTaxDeferred: recordedContributionsTaxDeferred,
			contributionsTaxFree: recordedContributionsTaxFree,
			contributionsCash: recordedContributionsCash,
			employerContributions,
			employeeDeferral: contributing
				? plannedContributions.employeeDeferral
				: 0,
			cashFlowLeftover,
			cashFlowTax: taxResult.totalTax,
			withdrawalsTaxable: withdrawal.taxable,
			withdrawalsTaxDeferred: withdrawal.taxDeferred,
			withdrawalsTaxFree: withdrawal.taxFree,
			requiredMinimumDistribution: rmd,
			rothConversion,
			livingExpenses,
			// Debt service and premiums are contractual, so they sit on the
			// essential side. With one-time outflows reported separately,
			// essential + flexible + oneTimeExpenses === totalOutflow.
			essentialExpenses:
				livingExpenses * inputs.essentialShare +
				housingExpenses +
				healthcareExpenses +
				essentialRecurring +
				insurancePremiums +
				otherDebtService,
			flexibleExpenses:
				livingExpenses * (1 - inputs.essentialShare) +
				(recurringExpenseTotal - essentialRecurring),
			healthcareExpenses,
			housingExpenses,
			oneTimeExpenses: oneTimeOutflows,
			insurancePremiums,
			totalOutflow,
			taxableIncome: displayTaxResult.taxableIncome,
			taxesPaid: displayTaxResult.totalTax,
			marginalRate: displayTaxResult.marginalRate,
			effectiveRate: displayTaxResult.effectiveRate,
			spendableIncome: grossIncome - taxResult.totalTax,
			...snapshot,
			shortfall: withdrawal.unmet,
			inflationFactor,
			netWorthTodayDollars: toTodayDollars(
				netWorth,
				inputs.inflationRate,
				yearIndex,
			),
			liquidAssetsTodayDollars: toTodayDollars(
				liquidAssets,
				inputs.inflationRate,
				yearIndex,
			),
		});
	}

	const lastYear = years.at(-1);
	const legacyAtLongevity = lastYear?.netWorth ?? 0;

	return {
		years,
		opening,
		milestones: buildMilestones(inputs),
		assetsAtRetirement,
		netWorthAtRetirement,
		legacyAtLongevity,
		lifetimeTaxes,
		lifetimeSocialSecurity,
		firstShortfallAge,
		fundedThroughLongevity: firstShortfallAge === null,
		totalShortfall,
	};
}

function mortgagePayoffAge(
	property: ProjectedProperty,
	currentAge: number,
): number | null {
	if (property.loanBalance <= 0) return null;
	let balance = property.loanBalance;
	let remainingTermMonths = property.remainingTermMonths;
	const payment = property.monthlyPayment + property.extraMonthlyPayment;
	if (payment <= 0 && remainingTermMonths <= 0) return null;
	for (let month = 1; month <= 600; month++) {
		const stepped = amortizeMonth({
			balance,
			annualInterestRate: property.annualInterestRate,
			monthlyPayment: payment,
			remainingTermMonths,
		});
		if (
			stepped.balance >= balance &&
			stepped.remainingTermMonths === remainingTermMonths
		) {
			return null;
		}
		balance = stepped.balance;
		remainingTermMonths = stepped.remainingTermMonths;
		if (balance <= 0) {
			return currentAge + Math.ceil(month / 12);
		}
	}
	return null;
}

function buildMilestones(inputs: RetirementPlanInputs): RetirementMilestone[] {
	const milestones: RetirementMilestone[] = [];
	const yearForAge = (age: number): number =>
		inputs.currentYear + (age - inputs.currentAge);
	const inHorizon = (age: number): boolean =>
		age >= inputs.currentAge && age <= inputs.longevityAge;

	const push = (
		kind: RetirementMilestone["kind"],
		label: string,
		age: number,
	): void => {
		if (!inHorizon(age)) return;
		milestones.push({ kind, label, age, year: yearForAge(age) });
	};

	push("retirement", "Retire", inputs.retirementAge);
	if (inputs.spouseRetirementAge !== null && inputs.spouseCurrentAge !== null) {
		const ageWhenSpouseRetires =
			inputs.currentAge +
			(inputs.spouseRetirementAge - inputs.spouseCurrentAge);
		push("spouseRetirement", "Spouse retires", ageWhenSpouseRetires);
	}
	push("socialSecurity", "Social Security", inputs.socialSecurity.claimAge);
	if (
		inputs.spouseSocialSecurity !== null &&
		inputs.spouseCurrentAge !== null
	) {
		const ageWhenSpouseClaims =
			inputs.currentAge +
			(inputs.spouseSocialSecurity.claimAge - inputs.spouseCurrentAge);
		push("spouseSocialSecurity", "Spouse Social Security", ageWhenSpouseClaims);
	}
	push("medicare", "Medicare", MEDICARE_AGE);
	push("rmd", "RMDs begin", inputs.rmdStartAge);

	for (const property of inputs.properties) {
		if (property.loanBalance > 0) {
			const payoffAge = mortgagePayoffAge(property, inputs.currentAge);
			if (payoffAge !== null) {
				push(
					"mortgagePaidOff",
					`${property.name} mortgage paid off`,
					payoffAge,
				);
			}
		}
		if (property.sellAtAge !== null) {
			push("homeSale", `Sell ${property.name}`, property.sellAtAge);
		}
	}

	for (const policy of inputs.lifeCoverage) {
		if (policy.expiresAtAge !== null) {
			push("policyExpiry", "Life policy expires", policy.expiresAtAge);
		}
	}
	for (const annuity of inputs.annuities) {
		push("annuityStart", "Annuity begins", annuity.atAge);
	}
	for (const event of inputs.longTermCareEvents) {
		push("longTermCare", "Long-term care event", event.atAge);
	}
	if (inputs.spouseDeathAtAge !== null) {
		push("spouseDeath", "Spouse passes", inputs.spouseDeathAtAge);
	}
	for (const flow of inputs.recurringExpenses) {
		if (flow.label.toLowerCase().includes("college")) {
			push("college", flow.label, flow.fromAge);
		}
	}

	// Deduplicate identical (kind, age) pairs and order by age.
	const seen = new Set<string>();
	return milestones
		.filter((milestone) => {
			const key = `${milestone.kind}:${milestone.age}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.sort((a, b) => a.age - b.age);
}
