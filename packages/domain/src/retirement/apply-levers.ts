// Folds an ordered lever stack into projection inputs.
//
// Two rules govern this file. First, a lever is never silently dropped: when two
// enabled levers write the same field the later one wins and both are reported
// with override metadata so the UI can show a badge. Second, nothing here reads
// a clock or mutates the baseline — `applyLevers` is pure, which is what lets
// Monte Carlo, stress tests, and Goal Seek call it thousands of times.

import type {
	RetirementAppliedLever,
	RetirementLever,
	RetirementScenarioLever,
	RetirementTaxTreatment,
} from "@moat/contracts";
import {
	getEmployeeDeferralLimit,
	getIraContributionLimit,
} from "../federal-rules";
import { amortizeMonth } from "./amortize";
import type { RetirementBaseline } from "./build-baseline";
import { toEngineMonthlySpend } from "./compose-spend";
import {
	ASSUMED_DOWN_PAYMENT_RATE,
	ASSUMED_MONTHLY_RENT_RATE,
	ASSUMED_MORTGAGE_RATE,
	ASSUMED_MORTGAGE_TERM_YEARS,
	ASSUMED_PROPERTY_EXPENSE_RATE,
	ASSUMED_VACANCY_RATE,
	DEFAULT_LTC_MONTHLY_COST,
	HOME_SALE_COST_RATE,
	MEDICARE_AGE,
	PORTFOLIO_PROFILES,
	stateIncomeTaxRate,
} from "./constants";
import { grossUpNetIncome } from "./defaults/gross-up";
import { describeLever } from "./describe-lever";
import { ensureContributionPolicy } from "./levers/patch-contribution-policy";
import { conflictFieldFor, leverApplyPhase } from "./levers/registry";
import type { ProjectedProperty, RetirementPlanInputs } from "./types";

export type ApplyLeversResult = {
	inputs: RetirementPlanInputs;
	appliedLevers: RetirementAppliedLever[];
};

/**
 * The mutable slot a lever writes. Two enabled levers sharing a slot conflict;
 * `null` means the lever is additive and always composes with its neighbours.
 */
function cloneInputs(inputs: RetirementPlanInputs): RetirementPlanInputs {
	return {
		...inputs,
		balances: { ...inputs.balances },
		contributions: { ...inputs.contributions },
		spendingStages: inputs.spendingStages.map((stage) => ({ ...stage })),
		properties: inputs.properties.map((property) => ({ ...property })),
		socialSecurity: { ...inputs.socialSecurity },
		spouseSocialSecurity:
			inputs.spouseSocialSecurity === null
				? null
				: { ...inputs.spouseSocialSecurity },
		stateTaxChange:
			inputs.stateTaxChange === null ? null : { ...inputs.stateTaxChange },
		withdrawalOrder: [...inputs.withdrawalOrder],
		oneTimeEvents: inputs.oneTimeEvents.map((event) => ({ ...event })),
		recurringIncome: inputs.recurringIncome.map((flow) => ({ ...flow })),
		recurringExpenses: inputs.recurringExpenses.map((flow) => ({ ...flow })),
		incomeGaps: inputs.incomeGaps.map((gap) => ({ ...gap })),
		incomeAdjustments: inputs.incomeAdjustments.map((entry) => ({ ...entry })),
		marketShocks: inputs.marketShocks.map((shock) => ({ ...shock })),
		sequenceRisk:
			inputs.sequenceRisk === null ? null : { ...inputs.sequenceRisk },
		rothConversion:
			inputs.rothConversion === null ? null : { ...inputs.rothConversion },
		annuities: inputs.annuities.map((annuity) => ({ ...annuity })),
		longTermCareEvents: inputs.longTermCareEvents.map((event) => ({
			...event,
		})),
		ltcCoverage: inputs.ltcCoverage === null ? null : { ...inputs.ltcCoverage },
		lifeCoverage: inputs.lifeCoverage.map((policy) => ({ ...policy })),
		disabilityEvents: inputs.disabilityEvents.map((event) => ({ ...event })),
		insurancePremiums: inputs.insurancePremiums.map((premium) => ({
			...premium,
		})),
		liabilities: (inputs.liabilities ?? []).map((liability) => ({
			...liability,
		})),
		preMedicareWindow:
			inputs.preMedicareWindow === null
				? null
				: { ...inputs.preMedicareWindow },
		returnSequence: inputs.returnSequence
			? [...inputs.returnSequence]
			: undefined,
		liquidTypeMix: inputs.liquidTypeMix
			? { ...inputs.liquidTypeMix }
			: undefined,
		contributionPolicy: inputs.contributionPolicy
			? structuredClone(inputs.contributionPolicy)
			: undefined,
		cashPolicy: inputs.cashPolicy
			? structuredClone(inputs.cashPolicy)
			: undefined,
		returnSchedule: inputs.returnSchedule
			? [...inputs.returnSchedule]
			: undefined,
		stateRetirementTaxProfile: inputs.stateRetirementTaxProfile
			? { ...inputs.stateRetirementTaxProfile }
			: undefined,
		stateTaxChangeProfile: inputs.stateTaxChangeProfile
			? { ...inputs.stateTaxChangeProfile }
			: undefined,
	};
}

// ---------------------------------------------------------------------------
// Property helpers
// ---------------------------------------------------------------------------

/** Level payment that fully amortizes `principal` over `months`. */
function levelPayment(
	principal: number,
	annualRate: number,
	months: number,
): number {
	if (principal <= 0 || months <= 0) return 0;
	const monthlyRate = annualRate / 12;
	if (monthlyRate <= 0) return principal / months;
	return (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months);
}

/** Balance remaining after `months` of the property's current payment plan. */
function projectedLoanBalance(
	property: ProjectedProperty,
	months: number,
): number {
	let balance = property.loanBalance;
	let remainingTermMonths = property.remainingTermMonths;
	if (balance <= 0) return 0;
	const payment = property.monthlyPayment + property.extraMonthlyPayment;
	for (let month = 0; month < months && balance > 0; month++) {
		const stepped = amortizeMonth({
			balance,
			annualInterestRate: property.annualInterestRate,
			monthlyPayment: payment,
			remainingTermMonths,
		});
		balance = stepped.balance;
		remainingTermMonths = stepped.remainingTermMonths;
	}
	return balance;
}

function projectedValue(property: ProjectedProperty, years: number): number {
	return property.value * (1 + property.appreciationRate) ** Math.max(0, years);
}

/** Equity a sale at `atAge` would free up, net of selling costs. */
function projectedNetEquity(
	property: ProjectedProperty,
	currentAge: number,
	atAge: number,
): number {
	const years = Math.max(0, atAge - currentAge);
	const value = projectedValue(property, years);
	const balance = projectedLoanBalance(property, years * 12);
	return Math.max(0, value * (1 - HOME_SALE_COST_RATE) - balance);
}

function newFinancedProperty(input: {
	id: string;
	name: string;
	isPrimaryResidence: boolean;
	price: number;
	downPayment: number;
	annualRate: number;
	termYears: number;
	monthlyRent: number;
	monthlyExpenses: number;
	acquiredAtAge: number;
	appreciationRate: number;
	expenseGrowthRate: number;
}): ProjectedProperty {
	const downPayment = Math.min(Math.max(0, input.downPayment), input.price);
	const loanBalance = Math.max(0, input.price - downPayment);
	const termMonths = input.termYears * 12;
	return {
		id: input.id,
		name: input.name,
		isPrimaryResidence: input.isPrimaryResidence,
		value: input.price,
		loanBalance,
		annualInterestRate: input.annualRate,
		remainingTermMonths: loanBalance > 0 ? termMonths : 0,
		monthlyPayment: levelPayment(loanBalance, input.annualRate, termMonths),
		monthlyRent: input.monthlyRent,
		monthlyExpenses: input.monthlyExpenses,
		vacancyRate: input.monthlyRent > 0 ? ASSUMED_VACANCY_RATE : 0,
		appreciationRate: input.appreciationRate,
		expenseGrowthRate: input.expenseGrowthRate,
		extraMonthlyPayment: 0,
		sellAtAge: null,
		acquiredAtAge: input.acquiredAtAge,
		downPayment,
		costBasis: input.price,
	};
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

type LeverOutcome = { applied: boolean; note: string | null };

const APPLIED: LeverOutcome = { applied: true, note: null };

function skip(note: string): LeverOutcome {
	return { applied: false, note };
}

function applyAfterContributionSetters(type: RetirementLever["type"]): boolean {
	return leverApplyPhase(type) !== "standard";
}

function growToAge(
	amount: number,
	annualRate: number,
	fromAge: number,
	toAge: number,
): number {
	const years = Math.max(0, toAge - fromAge);
	return amount * (1 + annualRate) ** years;
}

export function applyLevers(
	baseline: RetirementBaseline,
	levers: RetirementScenarioLever[],
): ApplyLeversResult {
	const inputs = cloneInputs(baseline.inputs);
	const ordered = levers
		.map((entry, index) => ({
			...entry,
			sortOrder: entry.sortOrder ?? index,
		}))
		.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

	// Resolve conflicts before applying anything: within a slot, the last
	// enabled lever wins and the earlier ones are reported as overridden.
	const winnerBySlot = new Map<string, RetirementScenarioLever>();
	for (const entry of ordered) {
		if (!entry.enabled) continue;
		const slot = conflictFieldFor(entry.lever);
		if (slot === null) continue;
		winnerBySlot.set(slot, entry);
	}
	const overridesByWinnerId = new Map<string, string[]>();
	for (const entry of ordered) {
		if (!entry.enabled) continue;
		const slot = conflictFieldFor(entry.lever);
		if (slot === null) continue;
		const winner = winnerBySlot.get(slot);
		if (!winner || winner.id === entry.id) continue;
		const existing = overridesByWinnerId.get(winner.id) ?? [];
		existing.push(entry.id);
		overridesByWinnerId.set(winner.id, existing);
	}

	const appliedLevers: RetirementAppliedLever[] = [];
	const contributionProgress: ContributionProgress = {
		employee401k: baseline.detected.annual401kContribution,
		rothIra: baseline.detected.annualRothContribution,
		hsa: baseline.detected.annualHsaContribution,
	};

	for (const entry of ordered) {
		const slot = conflictFieldFor(entry.lever);
		const winner = slot !== null ? winnerBySlot.get(slot) : undefined;
		const overriddenBy =
			entry.enabled && winner && winner.id !== entry.id ? winner : null;

		let outcome: LeverOutcome = { applied: false, note: null };
		if (
			entry.enabled &&
			overriddenBy === null &&
			!applyAfterContributionSetters(entry.lever.type)
		) {
			outcome = applyOne(inputs, baseline, entry.lever, contributionProgress);
		}

		appliedLevers.push({
			id: entry.id,
			type: entry.lever.type,
			enabled: entry.enabled,
			sortOrder: entry.sortOrder,
			applied: outcome.applied,
			conflictField: slot,
			overriddenByLeverId: overriddenBy?.id ?? null,
			overriddenByLabel:
				overriddenBy !== null ? describeLever(overriddenBy.lever) : null,
			overridesLeverIds: overridesByWinnerId.get(entry.id) ?? [],
			note: outcome.note,
		});
	}

	for (const entry of ordered) {
		if (!entry.enabled || leverApplyPhase(entry.lever.type) !== "relative")
			continue;
		const row = appliedLevers.find((item) => item.id === entry.id);
		if (!row || row.overriddenByLeverId !== null) continue;
		const outcome = applyOne(
			inputs,
			baseline,
			entry.lever,
			contributionProgress,
		);
		row.applied = outcome.applied;
		row.note = outcome.note;
	}

	for (const entry of ordered) {
		if (!entry.enabled || leverApplyPhase(entry.lever.type) !== "employerMatch")
			continue;
		const row = appliedLevers.find((item) => item.id === entry.id);
		if (!row || row.overriddenByLeverId !== null) continue;
		const outcome = applyOne(
			inputs,
			baseline,
			entry.lever,
			contributionProgress,
		);
		row.applied = outcome.applied;
		row.note = outcome.note;
	}

	normalizeInputs(inputs);
	return { inputs, appliedLevers };
}

/** Keeps derived ages consistent after arbitrary lever edits. */
function normalizeInputs(inputs: RetirementPlanInputs): void {
	inputs.retirementAge = Math.max(
		inputs.currentAge,
		Math.round(inputs.retirementAge),
	);
	inputs.longevityAge = Math.max(
		inputs.retirementAge + 1,
		Math.round(inputs.longevityAge),
	);
	inputs.returnRate = Math.max(-0.5, Math.min(0.5, inputs.returnRate));
	if (inputs.bucketReturns) {
		inputs.bucketReturns = {
			taxable: Math.max(-0.5, Math.min(0.5, inputs.bucketReturns.taxable)),
			taxDeferred: Math.max(
				-0.5,
				Math.min(0.5, inputs.bucketReturns.taxDeferred),
			),
			taxFree: Math.max(-0.5, Math.min(0.5, inputs.bucketReturns.taxFree)),
		};
	}
	inputs.inflationRate = Math.max(-0.1, Math.min(0.3, inputs.inflationRate));
	inputs.retirementMonthlySpending = Math.max(
		0,
		inputs.retirementMonthlySpending,
	);
	inputs.contributions.taxable = Math.max(0, inputs.contributions.taxable);
	inputs.contributions.taxDeferred = Math.max(
		0,
		inputs.contributions.taxDeferred,
	);
	inputs.contributions.taxFree = Math.max(0, inputs.contributions.taxFree);
	inputs.annualHealthcareSpending = Math.max(
		0,
		inputs.annualHealthcareSpending,
	);
	inputs.healthcareCostMultiplier = Math.max(
		0,
		inputs.healthcareCostMultiplier,
	);
}

function setRetirementAge(inputs: RetirementPlanInputs, age: number): void {
	const previous = inputs.retirementAge;
	inputs.retirementAge = age;
	// Employment and contributions track the retirement date unless a lever has
	// already moved them somewhere else on purpose.
	if (inputs.employmentEndsAtAge === previous) {
		inputs.employmentEndsAtAge = age;
	}
	if (inputs.contributionsStopAge === previous) {
		inputs.contributionsStopAge = age;
	}
}

function isOwnedAt(property: ProjectedProperty, age: number): boolean {
	if (property.acquiredAtAge !== null && property.acquiredAtAge > age) {
		return false;
	}
	if (property.sellAtAge !== null && property.sellAtAge <= age) {
		return false;
	}
	return true;
}

function primaryResidenceOwnedAt(
	inputs: RetirementPlanInputs,
	age: number,
): ProjectedProperty | null {
	return (
		inputs.properties.find(
			(property) => property.isPrimaryResidence && isOwnedAt(property, age),
		) ?? null
	);
}

function resolveMortgageTarget(
	inputs: RetirementPlanInputs,
	propertyId: string | undefined,
): ProjectedProperty | null {
	if (propertyId !== undefined) {
		return (
			inputs.properties.find((property) => property.id === propertyId) ?? null
		);
	}
	return (
		inputs.properties.find(
			(property) => property.isPrimaryResidence && property.loanBalance > 0,
		) ??
		inputs.properties.find((property) => property.loanBalance > 0) ??
		null
	);
}

function taxTreatmentForAccount(
	baseline: RetirementBaseline,
	accountId: string | undefined,
): RetirementTaxTreatment | null {
	if (accountId === undefined) return null;
	return (
		baseline.accounts.find((account) => account.id === accountId)
			?.taxTreatment ?? null
	);
}

type ContributionProgress = {
	employee401k: number;
	rothIra: number;
	hsa: number;
};

function applyOne(
	inputs: RetirementPlanInputs,
	baseline: RetirementBaseline,
	lever: RetirementLever,
	progress: ContributionProgress,
): LeverOutcome {
	const hasSpouse = inputs.spouseCurrentAge !== null;

	switch (lever.type) {
		// ─── Work & income ────────────────────────────────────────────────────
		case "retire_earlier": {
			const age = Math.max(
				inputs.currentAge,
				inputs.retirementAge - lever.params.years,
			);
			if (age === inputs.retirementAge) {
				return skip("You are already at or past that retirement age.");
			}
			setRetirementAge(inputs, age);
			return APPLIED;
		}
		case "retire_later": {
			setRetirementAge(inputs, inputs.retirementAge + lever.params.years);
			return APPLIED;
		}
		case "retire_at_age": {
			setRetirementAge(inputs, Math.max(inputs.currentAge, lever.params.age));
			return APPLIED;
		}
		case "stop_working_at_age": {
			inputs.employmentEndsAtAge = Math.max(
				inputs.currentAge,
				lever.params.age,
			);
			inputs.contributionsStopAge = Math.min(
				inputs.contributionsStopAge,
				inputs.employmentEndsAtAge,
			);
			return APPLIED;
		}
		case "part_time_before_retirement": {
			inputs.incomeAdjustments.push({
				whom: "primary",
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge,
				annualDelta: 0,
				percentDelta: 0,
				setTo: lever.params.annualIncome,
			});
			// Part-time work past the old employment end date extends earning.
			inputs.employmentEndsAtAge = Math.max(
				inputs.employmentEndsAtAge,
				lever.params.toAge + 1,
			);
			return APPLIED;
		}
		case "spouse_retire_at_age": {
			if (!hasSpouse) return skip("This plan has no spouse.");
			inputs.spouseRetirementAge = lever.params.age;
			inputs.spouseEmploymentEndsAtAge = lever.params.age;
			return APPLIED;
		}
		case "spouse_stops_working": {
			if (!hasSpouse) return skip("This plan has no spouse.");
			inputs.spouseEmploymentEndsAtAge = lever.params.atAge;
			return APPLIED;
		}
		case "income_change": {
			if (lever.params.whom === "spouse" && !hasSpouse) {
				return skip("This plan has no spouse.");
			}
			inputs.incomeAdjustments.push({
				whom: lever.params.whom,
				fromAge: lever.params.fromAge ?? inputs.currentAge,
				toAge: null,
				annualDelta: lever.params.annualDelta ?? 0,
				percentDelta: lever.params.percentDelta ?? 0,
				setTo: null,
			});
			return APPLIED;
		}
		case "job_loss": {
			let remaining = lever.params.monthsOut;
			let age = lever.params.atAge;
			while (remaining > 0) {
				const months = Math.min(12, remaining);
				inputs.incomeGaps.push({
					label: "Job loss",
					whom: "primary",
					fromAge: age,
					toAge: age + 1,
					severance:
						age === lever.params.atAge
							? (lever.params.severanceAmount ?? 0)
							: 0,
					shareOfYear: months / 12,
				});
				remaining -= months;
				age += 1;
			}
			return APPLIED;
		}
		case "career_break": {
			inputs.incomeGaps.push({
				label: "Career break",
				whom: "primary",
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge + 1,
				severance: 0,
				shareOfYear: 1,
			});
			return APPLIED;
		}
		case "annual_bonus": {
			inputs.recurringIncome.push({
				label: "Annual bonus",
				annualAmount: lever.params.amount,
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge,
				taxTreatment: "ordinaryIncome",
			});
			return APPLIED;
		}
		case "side_business_income": {
			inputs.recurringIncome.push({
				label: "Side business",
				annualAmount: lever.params.annualAmount,
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge,
				taxTreatment: "ordinaryIncome",
			});
			return APPLIED;
		}
		case "rental_income_change": {
			inputs.recurringIncome.push({
				label: "Rental income change",
				annualAmount: lever.params.monthlyAmount * 12,
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge ?? inputs.longevityAge,
				taxTreatment: "ordinaryIncome",
			});
			return APPLIED;
		}

		// ─── Savings ──────────────────────────────────────────────────────────
		case "contribution_change": {
			const treatment =
				lever.params.taxTreatment ??
				taxTreatmentForAccount(baseline, lever.params.accountId) ??
				"taxDeferred";
			const annualDelta = lever.params.monthlyDelta * 12;
			const policy = ensureContributionPolicy(inputs);
			if (treatment === "taxDeferred") {
				const current = policy.primary.employerPlan.amount ?? 0;
				policy.primary.employerPlan.mode = "fixedAnnual";
				policy.primary.employerPlan.amount = Math.max(0, current + annualDelta);
				progress.employee401k = Math.max(
					0,
					progress.employee401k + annualDelta,
				);
			} else if (treatment === "taxFree") {
				const current = policy.primary.ira.amount ?? 0;
				policy.primary.ira.mode = "fixedAnnual";
				policy.primary.ira.kind = "roth";
				policy.primary.ira.amount = Math.max(0, current + annualDelta);
				progress.rothIra = Math.max(0, progress.rothIra + annualDelta);
			} else {
				policy.primary.taxableMonthly = Math.max(
					0,
					policy.primary.taxableMonthly + lever.params.monthlyDelta,
				);
			}
			return APPLIED;
		}
		case "max_401k": {
			const policy = ensureContributionPolicy(inputs);
			if (
				policy.primary.employerPlan.mode === "maxAllowed" &&
				policy.autoApplyCatchUp === lever.params.includeCatchUp
			) {
				return skip("Your 401(k) contributions already hit the limit.");
			}
			policy.primary.employerPlan.mode = "maxAllowed";
			policy.primary.employerPlan.amount = null;
			policy.autoApplyCatchUp = lever.params.includeCatchUp;
			progress.employee401k = getEmployeeDeferralLimit({
				taxYear: inputs.taxYear,
				age: inputs.currentAge,
				autoApplyCatchUp: lever.params.includeCatchUp,
			}).amount;
			return APPLIED;
		}
		case "max_roth_ira": {
			const policy = ensureContributionPolicy(inputs);
			if (policy.primary.ira.mode === "maxAllowed") {
				return skip("Your IRA contributions already hit the limit.");
			}
			policy.primary.ira.mode = "maxAllowed";
			policy.primary.ira.kind = "roth";
			policy.primary.ira.amount = null;
			policy.autoApplyCatchUp = lever.params.includeCatchUp;
			progress.rothIra = getIraContributionLimit({
				taxYear: inputs.taxYear,
				age: inputs.currentAge,
				autoApplyCatchUp: lever.params.includeCatchUp,
			}).amount;
			return APPLIED;
		}
		case "max_spousal_iras": {
			if (!hasSpouse) return skip("This plan has no spouse.");
			const policy = ensureContributionPolicy(inputs);
			policy.primary.ira.mode = "maxAllowed";
			policy.primary.ira.kind = "roth";
			policy.primary.ira.amount = null;
			if (!policy.spouse) {
				const spouseGrossed = grossUpNetIncome({
					netIncome: inputs.annualSpouseEmploymentIncome,
					filingStatus: inputs.filingStatus,
					stateTaxRate: inputs.stateTaxRate,
				});
				policy.spouse = structuredClone(policy.primary);
				policy.spouse.grossAnnualCompensation =
					spouseGrossed.grossAnnualCompensation;
				policy.spouse.wageTaxRate = spouseGrossed.wageTaxRate;
				policy.spouse.employerPlan.mode = "none";
				policy.spouse.employerPlan.amount = null;
				policy.spouse.taxableMonthly = 0;
			}
			policy.spouse.ira.mode = "maxAllowed";
			policy.spouse.ira.kind = "roth";
			policy.spouse.ira.amount = null;
			policy.autoApplyCatchUp = lever.params.includeCatchUp;
			return APPLIED;
		}
		case "employer_match": {
			const salary = inputs.annualEmploymentIncome;
			if (salary <= 0) return skip("No employment income to match.");
			const policy = ensureContributionPolicy(inputs);
			if (
				policy.primary.employerPlan.mode === "none" &&
				(policy.primary.employerPlan.amount ?? 0) <= 0
			) {
				return skip("Contribute to a 401(k) first to earn a match.");
			}
			policy.primary.employerPlan.match = [
				{
					matchRate: lever.params.matchPercent,
					upToPercent: lever.params.upToPercentOfSalary,
				},
			];
			return APPLIED;
		}
		case "max_hsa": {
			const policy = ensureContributionPolicy(inputs);
			if (policy.primary.hsa.mode === "maxAllowed") {
				return skip("Your HSA contributions already hit the limit.");
			}
			policy.primary.hsa.mode = "maxAllowed";
			policy.primary.hsa.coverage =
				lever.params.coverageType === "family" ? "family" : "self";
			policy.primary.hsa.employeeAmount = null;
			return APPLIED;
		}
		case "taxable_investing": {
			const policy = ensureContributionPolicy(inputs);
			policy.primary.taxableMonthly += lever.params.monthlyAmount;
			return APPLIED;
		}
		case "stop_contributions_at_age": {
			inputs.contributionsStopAge = lever.params.age;
			const policy = inputs.contributionPolicy;
			if (policy) policy.contributionsStopAge = lever.params.age;
			return APPLIED;
		}

		// ─── Retirement spending ──────────────────────────────────────────────
		case "retirement_spending_change": {
			inputs.retirementMonthlySpending = Math.max(
				0,
				inputs.retirementMonthlySpending + lever.params.monthlyDelta,
			);
			for (const stage of inputs.spendingStages) {
				stage.monthlyAmount = Math.max(
					0,
					stage.monthlyAmount + lever.params.monthlyDelta,
				);
			}
			return APPLIED;
		}
		case "retirement_spending_set": {
			inputs.retirementMonthlySpending = toEngineMonthlySpend(
				lever.params.monthlyAmount,
				baseline.spendingExclusions,
			);
			// An explicit flat figure replaces any staged schedule.
			inputs.spendingStages = [];
			return APPLIED;
		}
		case "retirement_spending_stages": {
			inputs.spendingStages = lever.params.stages.map((stage) => ({
				...stage,
				monthlyAmount: toEngineMonthlySpend(
					stage.monthlyAmount,
					baseline.spendingExclusions,
				),
			}));
			return APPLIED;
		}
		case "spending_category_change": {
			if (lever.params.lineItemType !== "expense") return APPLIED;
			const monthlyDelta = lever.params.monthlyDelta;
			inputs.preRetirementAnnualSpending = Math.max(
				0,
				inputs.preRetirementAnnualSpending + monthlyDelta * 12,
			);
			inputs.retirementMonthlySpending = Math.max(
				0,
				inputs.retirementMonthlySpending + monthlyDelta,
			);
			for (const stage of inputs.spendingStages) {
				stage.monthlyAmount = Math.max(0, stage.monthlyAmount + monthlyDelta);
			}
			return APPLIED;
		}

		// ─── Investments ──────────────────────────────────────────────────────
		case "return_rate_delta": {
			inputs.returnRate += lever.params.delta;
			if (inputs.bucketReturns) {
				inputs.bucketReturns = {
					taxable: inputs.bucketReturns.taxable + lever.params.delta,
					taxDeferred: inputs.bucketReturns.taxDeferred + lever.params.delta,
					taxFree: inputs.bucketReturns.taxFree + lever.params.delta,
				};
			}
			return APPLIED;
		}
		case "return_rate_set": {
			inputs.returnRate = lever.params.rate;
			inputs.bucketReturns = {
				taxable: lever.params.rate,
				taxDeferred: lever.params.rate,
				taxFree: lever.params.rate,
			};
			return APPLIED;
		}
		case "inflation_delta": {
			inputs.inflationRate += lever.params.delta;
			return APPLIED;
		}
		case "portfolio_shift": {
			const profile = PORTFOLIO_PROFILES[lever.params.target];
			inputs.returnRate = profile.returnRate;
			inputs.volatility = profile.volatility;
			inputs.bucketReturns = {
				taxable: profile.returnRate,
				taxDeferred: profile.returnRate,
				taxFree: profile.returnRate,
			};
			return APPLIED;
		}
		case "market_crash": {
			inputs.marketShocks.push({
				atAge: lever.params.atAge,
				dropPercent: lever.params.dropPercent,
				recoveryYears: lever.params.recoveryYears,
			});
			return APPLIED;
		}
		case "sequence_risk": {
			inputs.sequenceRisk = {
				years: lever.params.years,
				annualReturn: lever.params.annualReturn,
			};
			return APPLIED;
		}

		// ─── Social Security ──────────────────────────────────────────────────
		case "social_security_claim_age": {
			inputs.socialSecurity.claimAge = lever.params.age;
			return APPLIED;
		}
		case "spouse_social_security_claim_age": {
			if (inputs.spouseSocialSecurity === null) {
				return skip("This plan has no spouse benefit on file.");
			}
			inputs.spouseSocialSecurity.claimAge = lever.params.age;
			return APPLIED;
		}
		case "social_security_haircut": {
			inputs.socialSecurity.haircut = lever.params.percent;
			if (inputs.spouseSocialSecurity !== null) {
				inputs.spouseSocialSecurity.haircut = lever.params.percent;
			}
			return APPLIED;
		}

		// ─── Housing ──────────────────────────────────────────────────────────
		case "mortgage_payoff_early": {
			const property = resolveMortgageTarget(inputs, lever.params.propertyId);
			if (property === null) return skip("No mortgage to pay down.");
			if (lever.params.extraMonthlyPayment !== undefined) {
				property.extraMonthlyPayment = lever.params.extraMonthlyPayment;
				return APPLIED;
			}
			const targetAge = lever.params.atAge;
			if (targetAge === undefined) {
				return skip("Choose a payoff age or an extra monthly payment.");
			}
			const months = Math.max(1, (targetAge - inputs.currentAge) * 12);
			const required = levelPayment(
				property.loanBalance,
				property.annualInterestRate,
				months,
			);
			property.extraMonthlyPayment = Math.max(
				0,
				required - property.monthlyPayment,
			);
			return APPLIED;
		}
		case "mortgage_extra_payment": {
			const property = resolveMortgageTarget(inputs, lever.params.propertyId);
			if (property === null) return skip("No mortgage to pay down.");
			property.extraMonthlyPayment = lever.params.monthlyAmount;
			return APPLIED;
		}
		case "mortgage_payoff_cancel": {
			const property = resolveMortgageTarget(inputs, lever.params.propertyId);
			if (property === null) return skip("No mortgage to change.");
			property.extraMonthlyPayment = 0;
			return APPLIED;
		}
		case "buy_home": {
			const isPrimary = lever.params.usage === "PRIMARY_RESIDENCE";
			const isRental = lever.params.usage === "RENTAL";
			const appreciation = baseline.context.realEstateAppreciationRate;
			const futurePrice = growToAge(
				lever.params.price,
				appreciation,
				inputs.currentAge,
				lever.params.atAge,
			);
			const futureDownPayment = growToAge(
				lever.params.downPayment,
				appreciation,
				inputs.currentAge,
				lever.params.atAge,
			);
			// Price is stored in acquisition-year dollars; rent and expenses stay
			// in today's dollars so the ledger's inflation factor is not applied twice.
			if (isPrimary) {
				const existing = primaryResidenceOwnedAt(inputs, lever.params.atAge);
				if (existing !== null) existing.sellAtAge = lever.params.atAge;
			}
			inputs.properties.push(
				newFinancedProperty({
					id: `lever-home-${lever.params.atAge}-${Math.round(lever.params.price)}`,
					name: isRental ? "Rental property" : "Home",
					isPrimaryResidence: isPrimary,
					price: futurePrice,
					downPayment: futureDownPayment,
					annualRate: lever.params.rate,
					termYears: lever.params.termYears,
					monthlyRent: isRental
						? lever.params.price * ASSUMED_MONTHLY_RENT_RATE
						: 0,
					monthlyExpenses:
						(lever.params.price * ASSUMED_PROPERTY_EXPENSE_RATE) / 12,
					acquiredAtAge: lever.params.atAge,
					appreciationRate: appreciation,
					expenseGrowthRate: inputs.inflationRate,
				}),
			);
			return APPLIED;
		}
		case "upsize_home":
		case "downsize_home": {
			const atAge = lever.params.atAge;
			const property = primaryResidenceOwnedAt(inputs, atAge);
			if (property === null) return skip("No primary residence on file.");
			const years = Math.max(0, atAge - inputs.currentAge);
			const futurePrice =
				lever.type === "upsize_home"
					? projectedValue(property, years) +
						growToAge(
							lever.params.priceDelta,
							property.appreciationRate,
							inputs.currentAge,
							atAge,
						)
					: growToAge(
							lever.params.newHomePrice,
							property.appreciationRate,
							inputs.currentAge,
							atAge,
						);
			const todayPrice =
				lever.type === "upsize_home"
					? property.value + lever.params.priceDelta
					: lever.params.newHomePrice;
			property.sellAtAge = atAge;
			const equity = projectedNetEquity(property, inputs.currentAge, atAge);
			// Sale proceeds fund the next down payment; anything short falls back
			// to a conventional 20%.
			const downPayment = Math.min(
				futurePrice,
				Math.max(equity, futurePrice * ASSUMED_DOWN_PAYMENT_RATE),
			);
			inputs.properties.push(
				newFinancedProperty({
					id: `lever-${lever.type}-${atAge}`,
					name: lever.type === "upsize_home" ? "Larger home" : "Smaller home",
					isPrimaryResidence: true,
					price: futurePrice,
					downPayment,
					annualRate: ASSUMED_MORTGAGE_RATE,
					termYears: ASSUMED_MORTGAGE_TERM_YEARS,
					monthlyRent: 0,
					monthlyExpenses: (todayPrice * ASSUMED_PROPERTY_EXPENSE_RATE) / 12,
					acquiredAtAge: atAge,
					appreciationRate: property.appreciationRate,
					expenseGrowthRate: property.expenseGrowthRate,
				}),
			);
			return APPLIED;
		}
		case "sell_primary_home": {
			const property = primaryResidenceOwnedAt(inputs, lever.params.atAge);
			if (property === null) return skip("No primary residence on file.");
			property.sellAtAge = lever.params.atAge;
			if (lever.params.thenRent !== false) {
				inputs.rentFromAge = lever.params.atAge;
				inputs.monthlyRentAfterHomeSale =
					lever.params.monthlyRent ??
					property.monthlyPayment + property.monthlyExpenses;
			}
			return APPLIED;
		}
		case "rent_instead": {
			const property = primaryResidenceOwnedAt(inputs, lever.params.fromAge);
			if (property !== null) property.sellAtAge = lever.params.fromAge;
			inputs.rentFromAge = lever.params.fromAge;
			inputs.monthlyRentAfterHomeSale = lever.params.monthlyRent;
			return APPLIED;
		}
		case "add_rental_property": {
			const appreciation = baseline.context.realEstateAppreciationRate;
			const futurePrice = growToAge(
				lever.params.price,
				appreciation,
				inputs.currentAge,
				lever.params.atAge,
			);
			const futureDownPayment = growToAge(
				lever.params.downPayment,
				appreciation,
				inputs.currentAge,
				lever.params.atAge,
			);
			inputs.properties.push(
				newFinancedProperty({
					id: `lever-rental-${lever.params.atAge}-${Math.round(lever.params.price)}`,
					name: "Rental property",
					isPrimaryResidence: false,
					price: futurePrice,
					downPayment: futureDownPayment,
					annualRate: ASSUMED_MORTGAGE_RATE,
					termYears: ASSUMED_MORTGAGE_TERM_YEARS,
					monthlyRent: lever.params.monthlyRent,
					monthlyExpenses: lever.params.monthlyExpenses,
					acquiredAtAge: lever.params.atAge,
					appreciationRate: appreciation,
					expenseGrowthRate: inputs.inflationRate,
				}),
			);
			return APPLIED;
		}
		case "sell_rental_property": {
			const property =
				lever.params.propertyId !== undefined
					? (inputs.properties.find(
							(candidate) => candidate.id === lever.params.propertyId,
						) ?? null)
					: (inputs.properties.find(
							(candidate) => !candidate.isPrimaryResidence,
						) ?? null);
			if (property === null) return skip("No rental property on file.");
			property.sellAtAge = lever.params.atAge;
			return APPLIED;
		}
		case "move_state": {
			inputs.stateTaxChange = {
				atAge: lever.params.atAge,
				rate:
					lever.params.stateTaxRate ??
					stateIncomeTaxRate(lever.params.stateCode, inputs.stateTaxRate),
			};
			return APPLIED;
		}

		// ─── Big life events ──────────────────────────────────────────────────
		case "add_dependent": {
			inputs.recurringExpenses.push({
				label: "Dependent",
				annualAmount: lever.params.annualCost,
				fromAge: lever.params.atAge,
				toAge: lever.params.atAge + lever.params.years - 1,
				essentiality: "essential",
			});
			return APPLIED;
		}
		case "fund_college": {
			inputs.recurringExpenses.push({
				label: "College",
				annualAmount: lever.params.annualCost,
				fromAge: lever.params.startAge,
				toAge: lever.params.startAge + lever.params.years - 1,
				essentiality: "essential",
			});
			return APPLIED;
		}
		case "charitable_gift": {
			if (lever.params.recurringYears !== undefined) {
				inputs.recurringExpenses.push({
					label: "Charitable giving",
					annualAmount: lever.params.amount,
					fromAge: lever.params.atAge,
					toAge: lever.params.atAge + lever.params.recurringYears - 1,
					essentiality: "flexible",
				});
			} else {
				inputs.oneTimeEvents.push({
					label: "Charitable gift",
					atAge: lever.params.atAge,
					amount: lever.params.amount,
					direction: "outflow",
					taxTreatment: "taxFree",
				});
			}
			return APPLIED;
		}
		case "recurring_purchase": {
			inputs.recurringExpenses.push({
				label: lever.params.label,
				annualAmount: lever.params.amount,
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge,
				everyNYears: lever.params.everyNYears,
				essentiality: "flexible",
			});
			return APPLIED;
		}

		// ─── Healthcare ───────────────────────────────────────────────────────
		case "healthcare_cost_delta": {
			if (
				lever.params.percentDelta === undefined &&
				lever.params.monthlyDelta === undefined
			) {
				return skip("Set a percentage or a dollar change.");
			}
			if (lever.params.percentDelta !== undefined) {
				inputs.healthcareCostMultiplier *= 1 + lever.params.percentDelta;
			}
			if (lever.params.monthlyDelta !== undefined) {
				inputs.annualHealthcareSpending = Math.max(
					0,
					inputs.annualHealthcareSpending + lever.params.monthlyDelta * 12,
				);
			}
			return APPLIED;
		}
		case "pre_medicare_coverage": {
			inputs.preMedicareMonthlyPremium = lever.params.monthlyPremium;
			inputs.preMedicareWindow = {
				fromAge: lever.params.fromAge,
				toAge: Math.min(lever.params.toAge, MEDICARE_AGE - 1),
			};
			return APPLIED;
		}
		case "long_term_care_event": {
			if (lever.params.whom !== "primary" && !hasSpouse) {
				return skip("This plan has no spouse.");
			}
			inputs.longTermCareEvents.push({
				atAge: lever.params.atAge,
				years: lever.params.years,
				monthlyCost:
					lever.params.monthlyCost > 0
						? lever.params.monthlyCost
						: DEFAULT_LTC_MONTHLY_COST,
				whom: lever.params.whom,
			});
			return APPLIED;
		}

		// ─── Insurance ────────────────────────────────────────────────────────
		case "life_insurance_change": {
			const { policyId, remove, deathBenefit, annualPremium, termYears } =
				lever.params;
			if (remove) {
				const before = inputs.lifeCoverage.length;
				inputs.lifeCoverage = inputs.lifeCoverage.filter((policy) =>
					policyId === undefined ? false : policy.id !== policyId,
				);
				inputs.insurancePremiums = inputs.insurancePremiums.filter((premium) =>
					policyId === undefined
						? premium.label !== "life"
						: premium.id !== policyId,
				);
				if (before === inputs.lifeCoverage.length) {
					return skip("No matching life policy to remove.");
				}
				return APPLIED;
			}
			const expiresAtAge =
				termYears !== undefined ? inputs.currentAge + termYears : null;
			const existing =
				policyId !== undefined
					? inputs.lifeCoverage.find((policy) => policy.id === policyId)
					: undefined;
			if (existing) {
				if (deathBenefit !== undefined) existing.deathBenefit = deathBenefit;
				if (termYears !== undefined) existing.expiresAtAge = expiresAtAge;
				if (annualPremium !== undefined) {
					const premium = inputs.insurancePremiums.find(
						(entry) => entry.id === policyId,
					);
					if (premium) premium.annualPremium = annualPremium;
					else {
						inputs.insurancePremiums.push({
							id: policyId as string,
							label: "life",
							annualPremium,
							expiresAtAge,
						});
					}
				}
				return APPLIED;
			}
			if (deathBenefit === undefined) {
				return skip("Set a death benefit for the new policy.");
			}
			const id = `lever-life-${Math.round(deathBenefit)}`;
			inputs.lifeCoverage.push({
				id,
				deathBenefit,
				annualPremium: 0,
				expiresAtAge,
				insured: "primary",
			});
			inputs.insurancePremiums.push({
				id,
				label: "life",
				annualPremium: annualPremium ?? 0,
				expiresAtAge,
			});
			return APPLIED;
		}
		case "policy_expires": {
			let matched = false;
			for (const policy of inputs.lifeCoverage) {
				if (policy.id !== lever.params.policyId) continue;
				policy.expiresAtAge = lever.params.atAge;
				matched = true;
			}
			if (inputs.ltcCoverage?.id === lever.params.policyId) {
				inputs.ltcCoverage.expiresAtAge = lever.params.atAge;
				matched = true;
			}
			for (const premium of inputs.insurancePremiums) {
				if (premium.id !== lever.params.policyId) continue;
				premium.expiresAtAge = lever.params.atAge;
				matched = true;
			}
			if (!matched) return skip("No matching policy on file.");
			return APPLIED;
		}
		case "ltc_policy_change": {
			if (lever.params.remove) {
				if (inputs.ltcCoverage === null) {
					return skip("No long-term care policy to remove.");
				}
				const removedId = inputs.ltcCoverage.id;
				inputs.ltcCoverage = null;
				inputs.insurancePremiums = inputs.insurancePremiums.filter(
					(premium) => premium.id !== removedId,
				);
				return APPLIED;
			}
			const current = inputs.ltcCoverage;
			inputs.ltcCoverage = {
				id: lever.params.policyId ?? current?.id ?? null,
				monthlyBenefit:
					lever.params.monthlyBenefit ?? current?.monthlyBenefit ?? 0,
				benefitYears: lever.params.benefitYears ?? current?.benefitYears ?? 3,
				eliminationDays:
					lever.params.eliminationDays ?? current?.eliminationDays ?? 90,
				hasInflationProtection:
					lever.params.inflationProtection ??
					current?.hasInflationProtection ??
					false,
				expiresAtAge: current?.expiresAtAge ?? null,
			};
			if (inputs.ltcCoverage.monthlyBenefit <= 0) {
				inputs.ltcCoverage = current;
				return skip("Set a monthly benefit for the policy.");
			}
			return APPLIED;
		}
		case "annuity_begins": {
			inputs.annuities.push({
				atAge: lever.params.atAge,
				monthlyPayout: lever.params.monthlyPayout,
				premium: lever.params.premium,
				hasCola: lever.params.hasCola,
			});
			return APPLIED;
		}
		case "disability_event": {
			inputs.disabilityEvents.push({
				atAge: lever.params.atAge,
				durationYears: lever.params.durationYears,
				monthlyBenefit:
					lever.params.monthlyBenefit ?? baseline.disabilityMonthlyBenefit,
			});
			return APPLIED;
		}
		case "spouse_death": {
			if (!hasSpouse) return skip("This plan has no spouse.");
			inputs.spouseDeathAtAge = lever.params.atAge;
			return APPLIED;
		}

		// ─── Taxes ────────────────────────────────────────────────────────────
		case "roth_conversion": {
			if (
				lever.params.annualAmount === undefined &&
				lever.params.fillToBracket === undefined
			) {
				return skip("Set an annual amount or a bracket to fill.");
			}
			inputs.rothConversion = {
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge,
				annualAmount: lever.params.annualAmount ?? null,
				fillToBracket: lever.params.fillToBracket ?? null,
			};
			return APPLIED;
		}
		case "withdrawal_order": {
			const unique = new Set(lever.params.order);
			if (unique.size !== 3) {
				return skip("List each account type exactly once.");
			}
			inputs.withdrawalOrder = [...lever.params.order];
			return APPLIED;
		}

		// ─── Custom ───────────────────────────────────────────────────────────
		case "custom_income": {
			inputs.recurringIncome.push({
				label: lever.params.label,
				annualAmount:
					lever.params.cadence === "monthly"
						? lever.params.amount * 12
						: lever.params.amount,
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge,
				taxTreatment: lever.params.taxTreatment,
			});
			return APPLIED;
		}
		case "custom_expense": {
			inputs.recurringExpenses.push({
				label: lever.params.label,
				annualAmount:
					lever.params.cadence === "monthly"
						? lever.params.amount * 12
						: lever.params.amount,
				fromAge: lever.params.fromAge,
				toAge: lever.params.toAge,
				essentiality: lever.params.essentiality,
			});
			return APPLIED;
		}
		case "custom_one_time": {
			inputs.oneTimeEvents.push({
				label: lever.params.label,
				atAge: lever.params.atAge,
				amount: lever.params.amount,
				direction: lever.params.direction,
				taxTreatment: lever.params.taxTreatment,
			});
			return APPLIED;
		}
	}
}
