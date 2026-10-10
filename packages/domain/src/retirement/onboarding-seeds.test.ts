import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	onboardingSeedsToApply,
	resolveOnboardingAgeHints,
	retirementPlanSeedsFromOnboarding,
	shouldApplyOnboardingSeeds,
	toRetirementPlanningContext,
} from "@moat/data-access";

describe("resolveOnboardingAgeHints", () => {
	it("prefers onboarding retirement age over financial-profile assumptions", () => {
		const hints = resolveOnboardingAgeHints({
			currentAge: 62,
			retirementAge: 70,
			forecastAssumptions: { retirementAge: 65 },
		});
		assert.equal(hints.currentAgeHint, 62);
		assert.equal(hints.retirementAgeHint, 70);
	});

	it("falls back to forecast assumptions when onboarding age is missing", () => {
		const hints = resolveOnboardingAgeHints({
			forecastAssumptions: JSON.stringify({ retirementAge: 68 }),
		});
		assert.equal(hints.currentAgeHint, null);
		assert.equal(hints.retirementAgeHint, 68);
	});
});

describe("retirementPlanSeedsFromOnboarding", () => {
	it("converts current age into a birth year at seed time", () => {
		const seeds = retirementPlanSeedsFromOnboarding(
			{ currentAgeHint: 62, retirementAgeHint: 70 },
			new Date("2026-08-25T00:00:00.000Z"),
		);
		assert.equal(seeds.primaryBirthYear, 1964);
		assert.equal(seeds.targetRetirementAge, 70);
	});

	it("clamps target retirement age into the plan range", () => {
		const seeds = retirementPlanSeedsFromOnboarding({
			currentAgeHint: null,
			retirementAgeHint: 25,
		});
		assert.equal(seeds.targetRetirementAge, 30);
	});
});

describe("onboardingSeedsToApply", () => {
	it("does not rewrite a default plan when the hint matches the default", () => {
		const next = onboardingSeedsToApply(
			{ primaryBirthYear: null, targetRetirementAge: 65 },
			{ targetRetirementAge: 65 },
		);
		assert.deepEqual(next, {});
	});

	it("backfills an untouched default plan from onboarding", () => {
		const next = onboardingSeedsToApply(
			{ primaryBirthYear: null, targetRetirementAge: 65 },
			{ primaryBirthYear: 1964, targetRetirementAge: 70 },
		);
		assert.deepEqual(next, {
			primaryBirthYear: 1964,
			targetRetirementAge: 70,
		});
	});

	it("leaves a customized plan alone", () => {
		assert.equal(
			shouldApplyOnboardingSeeds({
				primaryBirthYear: 1964,
				targetRetirementAge: 65,
			}),
			false,
		);
		assert.deepEqual(
			onboardingSeedsToApply(
				{ primaryBirthYear: 1964, targetRetirementAge: 65 },
				{ targetRetirementAge: 70 },
			),
			{},
		);
	});
});

describe("toRetirementPlanningContext", () => {
	it("surfaces onboarding ages as planning hints", () => {
		const context = toRetirementPlanningContext({
			taxProfile: {},
			forecastAssumptions: { retirementAge: 65 },
			insurancePolicies: [],
			localOnlyIsUsable: false,
			currentAge: 40,
			retirementAge: 67,
		});
		assert.equal(context.currentAgeHint, 40);
		assert.equal(context.retirementAgeHint, 67);
	});

	it("converts financial-profile percent assumptions into engine decimals", () => {
		const context = toRetirementPlanningContext({
			taxProfile: {},
			forecastAssumptions: {
				inflationRate: 3.0,
				incomeGrowthRate: 3.0,
				investmentReturnRate: 7.0,
				realEstateAppreciationRate: 3.0,
				defaultCashYield: 4.5,
			},
			insurancePolicies: [],
			localOnlyIsUsable: false,
		});
		assert.equal(context.inflationRate, 0.03);
		assert.equal(context.incomeGrowthRate, 0.03);
		assert.equal(context.investmentReturnRate, 0.07);
		assert.equal(context.realEstateAppreciationRate, 0.03);
		assert.equal(context.cashYield, 0.045);
	});

	it("leaves scenario-style decimals alone", () => {
		const context = toRetirementPlanningContext({
			taxProfile: {},
			forecastAssumptions: {
				inflationRate: 0.03,
				incomeGrowthRate: 0.03,
				investmentReturnRate: 0.07,
				realEstateAppreciationRate: 0.03,
				defaultCashYield: 0.04,
			},
			insurancePolicies: [],
			localOnlyIsUsable: false,
		});
		assert.equal(context.inflationRate, 0.03);
		assert.equal(context.incomeGrowthRate, 0.03);
		assert.equal(context.investmentReturnRate, 0.07);
		assert.equal(context.realEstateAppreciationRate, 0.03);
		assert.equal(context.cashYield, 0.04);
	});

	it("parses percent assumptions from a JSON column", () => {
		const context = toRetirementPlanningContext({
			taxProfile: {},
			forecastAssumptions: JSON.stringify({
				inflationRate: 3,
				investmentReturnRate: 7,
				defaultCashYield: 4.5,
			}),
			insurancePolicies: [],
			localOnlyIsUsable: false,
		});
		assert.equal(context.inflationRate, 0.03);
		assert.equal(context.investmentReturnRate, 0.07);
		assert.equal(context.cashYield, 0.045);
	});
});
