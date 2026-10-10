import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	emptyRetirementPolicies,
	RETIREMENT_STANDING_RULE_KINDS,
	type RetirementStandingRule,
} from "@moat/contracts";
import { applyPolicies } from "../apply-policies";
import {
	DEFAULT_WITHDRAWAL_ORDER,
	PRE_MEDICARE_MONTHLY_PREMIUM,
} from "../constants";
import { projectRetirement } from "../project";
import type { RetirementPlanInputs } from "../types";
import { applyStandingRules } from "./apply-standing-rules";
import {
	defaultStandingRuleBody,
	describeStandingRule,
	hasStandingRuleModule,
	standingRuleKinds,
} from "./registry";

function baseInputs(
	overrides: Partial<RetirementPlanInputs> = {},
): RetirementPlanInputs {
	return {
		currentYear: 2026,
		currentAge: 50,
		primaryBirthYear: 1976,
		spouseCurrentAge: 50,
		retirementAge: 65,
		spouseRetirementAge: 65,
		longevityAge: 90,
		balances: { cash: 100_000, taxable: 0, taxDeferred: 0, taxFree: 0 },
		contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
		contributionsStopAge: 65,
		annualEmploymentIncome: 0,
		annualSpouseEmploymentIncome: 0,
		employmentEndsAtAge: 65,
		spouseEmploymentEndsAtAge: 65,
		returnRate: 0,
		inflationRate: 0,
		incomeGrowthRate: 0,
		cashYield: 0,
		volatility: 0,
		preRetirementAnnualSpending: 0,
		preRetirementAnnualNetIncome: 0,
		preRetirementAnnualHealthcare: 0,
		retirementMonthlySpending: 0,
		essentialShare: 0.65,
		spendingStages: [],
		annualHealthcareSpending: 0,
		healthcareCostMultiplier: 1,
		preMedicareMonthlyPremium: 0,
		preMedicareWindow: null,
		properties: [],
		monthlyRentAfterHomeSale: 0,
		rentFromAge: null,
		socialSecurity: {
			monthlyAtFra: 0,
			claimAge: 67,
			haircut: 0,
			isEstimated: false,
		},
		spouseSocialSecurity: null,
		filingStatus: "marriedJoint",
		stateTaxRate: 0,
		stateTaxChange: null,
		withdrawalOrder: [...DEFAULT_WITHDRAWAL_ORDER],
		rmdStartAge: 75,
		oneTimeEvents: [],
		recurringIncome: [],
		recurringExpenses: [],
		incomeGaps: [],
		incomeAdjustments: [],
		marketShocks: [],
		sequenceRisk: null,
		rothConversion: null,
		annuities: [],
		longTermCareEvents: [],
		ltcCoverage: null,
		lifeCoverage: [],
		disabilityEvents: [],
		spouseDeathAtAge: null,
		insurancePremiums: [],
		taxYear: 2026,
		...overrides,
	};
}

function rule(
	overrides: Partial<RetirementStandingRule> &
		Pick<RetirementStandingRule, "rule" | "label">,
): RetirementStandingRule {
	return {
		id: overrides.id ?? "rule-1",
		enabled: overrides.enabled ?? true,
		sortOrder: overrides.sortOrder ?? 0,
		source: overrides.source ?? "userEdited",
		label: overrides.label,
		rule: overrides.rule,
	};
}

describe("standing-rule registry", () => {
	it("covers every contract kind with default, describe, and compile", () => {
		assert.deepEqual(
			standingRuleKinds().sort(),
			[...RETIREMENT_STANDING_RULE_KINDS].sort(),
		);
		const ctx = {
			currentAge: 50,
			spouseCurrentAge: 50,
			retirementAge: 65,
			longevityAge: 90,
		};
		for (const kind of RETIREMENT_STANDING_RULE_KINDS) {
			assert.ok(hasStandingRuleModule(kind), `${kind} missing module`);
			const body = defaultStandingRuleBody(kind, ctx);
			assert.equal(body.kind, kind);
			const described = describeStandingRule(
				rule({ label: "Test", rule: body }),
			);
			assert.ok(described.length > 0, `${kind} has empty describe`);
			const host = baseInputs();
			const compiled = applyStandingRules(host, [
				rule({ label: "Test", rule: body }),
			]);
			assert.notEqual(compiled, host);
		}
	});
});

describe("applyStandingRules", () => {
	it("never mutates its input", () => {
		const host = baseInputs();
		const snapshot = structuredClone(host);
		applyStandingRules(host, [
			rule({
				label: "Consulting",
				rule: {
					kind: "RECURRING_INCOME",
					params: {
						annualAmount: 12_000,
						window: {
							fromAge: 55,
							toAge: 70,
							inflates: false,
							everyNYears: null,
						},
						taxTreatment: "ordinaryIncome",
					},
				},
			}),
		]);
		assert.deepEqual(host, snapshot);
	});

	it("leaves the host unchanged when every rule is disabled", () => {
		const host = baseInputs();
		const compiled = applyStandingRules(host, [
			rule({
				label: "Off",
				enabled: false,
				rule: {
					kind: "RECURRING_INCOME",
					params: {
						annualAmount: 12_000,
						window: {
							fromAge: 55,
							toAge: 70,
							inflates: false,
							everyNYears: null,
						},
						taxTreatment: "ordinaryIncome",
					},
				},
			}),
		]);
		assert.equal(compiled, host);
	});
});

describe("standing-rule projection", () => {
	it("puts recurring income in otherIncome for exactly the windowed years", () => {
		const compiled = applyStandingRules(baseInputs({ currentAge: 50 }), [
			rule({
				label: "Consulting",
				rule: {
					kind: "RECURRING_INCOME",
					params: {
						annualAmount: 12_000,
						window: {
							fromAge: 55,
							toAge: 70,
							inflates: false,
							everyNYears: null,
						},
						taxTreatment: "ordinaryIncome",
					},
				},
			}),
		]);
		const years = projectRetirement(compiled).years;
		const byAge = new Map(years.map((year) => [year.age, year.otherIncome]));
		assert.equal(byAge.get(54), 0);
		assert.equal(byAge.get(55), 12_000);
		assert.equal(byAge.get(70), 12_000);
		assert.equal(byAge.get(71), 0);
	});

	it("grows a pension at its COLA and drops to the survivor share after spouse death", () => {
		const compiled = applyStandingRules(
			baseInputs({
				currentAge: 60,
				spouseCurrentAge: 60,
				spouseDeathAtAge: 70,
				inflationRate: 0.1,
			}),
			[
				rule({
					label: "Spouse pension",
					rule: {
						kind: "PENSION",
						params: {
							monthlyBenefit: 1_000,
							startAge: 65,
							colaRate: 0.02,
							survivorPercent: 0.5,
							whom: "spouse",
							taxTreatment: "ordinaryIncome",
						},
					},
				}),
			],
		);
		const years = projectRetirement(compiled).years;
		const at65 = years.find((year) => year.age === 65);
		const at66 = years.find((year) => year.age === 66);
		const at70 = years.find((year) => year.age === 70);
		assert.ok(at65 && at66 && at70);
		assert.equal(at65.otherIncome, 12_000);
		assert.ok(Math.abs(at66.otherIncome - 12_000 * 1.02) < 0.01);
		assert.ok(Math.abs(at70.otherIncome - 12_000 * 1.02 ** 5 * 0.5) < 0.01);
	});

	it("applies the spousal Social Security rule with no extra input", () => {
		const years = projectRetirement(
			baseInputs({
				currentAge: 67,
				spouseCurrentAge: 67,
				socialSecurity: {
					monthlyAtFra: 2_000,
					claimAge: 67,
					haircut: 0,
					isEstimated: false,
				},
				spouseSocialSecurity: {
					monthlyAtFra: 700,
					claimAge: 67,
					haircut: 0,
					isEstimated: false,
				},
			}),
		).years;
		const first = years[0];
		assert.ok(first);
		assert.equal(first.spouseSocialSecurityIncome, 12_000);
	});

	it("feeds an annuity into the existing engine path", () => {
		const compiled = applyStandingRules(baseInputs({ currentAge: 64 }), [
			rule({
				label: "SPIA",
				rule: {
					kind: "ANNUITY",
					params: {
						monthlyPayout: 500,
						startAge: 65,
						premium: 80_000,
						hasCola: false,
					},
				},
			}),
		]);
		const years = projectRetirement(compiled).years;
		const at64 = years.find((year) => year.age === 64);
		const at65 = years.find((year) => year.age === 65);
		assert.ok(at64 && at65);
		assert.equal(at64.otherIncome, 0);
		assert.equal(at65.otherIncome, 6_000);
		assert.ok(at65.oneTimeExpenses >= 80_000);
	});
});

describe("empty policies", () => {
	it("compile to the same inputs the engine received before policies existed", () => {
		const host = baseInputs();
		const compiled = applyPolicies(host, emptyRetirementPolicies(), {
			primaryWageTaxRate: 0,
			spouseWageTaxRate: 0,
		});
		assert.deepEqual(compiled.contributionPolicy, host.contributionPolicy);
		assert.deepEqual(compiled.cashPolicy, host.cashPolicy);
		assert.deepEqual(compiled.rothConversion, host.rothConversion);
		assert.deepEqual(compiled.preMedicareWindow, host.preMedicareWindow);
		assert.deepEqual(compiled.returnSchedule, host.returnSchedule);
	});

	it("does not invent a pre-Medicare window from an empty healthcare policy", () => {
		const host = baseInputs({
			preMedicareMonthlyPremium: PRE_MEDICARE_MONTHLY_PREMIUM,
			preMedicareWindow: null,
		});
		const compiled = applyPolicies(host, emptyRetirementPolicies(), {
			primaryWageTaxRate: 0,
			spouseWageTaxRate: 0,
		});
		assert.equal(compiled.preMedicareWindow, null);
		assert.equal(
			compiled.preMedicareMonthlyPremium,
			PRE_MEDICARE_MONTHLY_PREMIUM,
		);
		assert.equal(compiled.medicareStartAge, host.medicareStartAge);
	});
});
