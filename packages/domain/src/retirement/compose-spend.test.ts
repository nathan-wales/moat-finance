import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	annualizeWindowTotal,
	composedSpendSum,
	composeSpend,
	monthlyAmountFromWindowTotal,
	toEngineMonthlySpend,
	toHeadlineMonthlySpend,
} from "./compose-spend";

const ZERO = {
	healthcareMonthly: 0,
	housingDebtServiceMonthly: 0,
	propertyOperatingMonthly: 0,
	insurancePremiumsMonthly: 0,
	otherDebtServiceMonthly: 0,
};

describe("composeSpend", () => {
	it("carves housing P&I exactly once out of an $8,000 headline", () => {
		const parts = composeSpend(8_000, {
			...ZERO,
			housingDebtServiceMonthly: 2_000,
		});
		assert.equal(parts.living, 6_000);
		assert.equal(parts.housing, 2_000);
		assert.equal(composedSpendSum(parts), 8_000);
		assert.equal(
			toEngineMonthlySpend(8_000, {
				...ZERO,
				housingDebtServiceMonthly: 2_000,
			}),
			6_000,
		);
	});

	it("keeps a liability-backed category in otherDebt, not living", () => {
		const parts = composeSpend(4_500, {
			...ZERO,
			otherDebtServiceMonthly: 500,
		});
		assert.equal(parts.living, 4_000);
		assert.equal(parts.otherDebt, 500);
		assert.equal(composedSpendSum(parts), 4_500);
	});

	it("round-trips engine living back to the headline", () => {
		const exclusions = {
			healthcareMonthly: 500,
			housingDebtServiceMonthly: 2_000,
			propertyOperatingMonthly: 400,
			insurancePremiumsMonthly: 150,
			otherDebtServiceMonthly: 500,
		};
		const engine = toEngineMonthlySpend(8_000, exclusions);
		assert.equal(toHeadlineMonthlySpend(engine, exclusions), 8_000);
	});

	it("partition sums to the headline for arbitrary carve-outs", () => {
		const headlines = [0, 1, 500, 8_000, 13_024, 100_000];
		const carveValues = [0, 200, 500, 2_000, 4_000];
		for (const headline of headlines) {
			for (const healthcareMonthly of carveValues) {
				for (const housingDebtServiceMonthly of carveValues) {
					const parts = composeSpend(headline, {
						healthcareMonthly,
						housingDebtServiceMonthly,
						propertyOperatingMonthly: 400,
						insurancePremiumsMonthly: 150,
						otherDebtServiceMonthly: 500,
					});
					assert.ok(
						Math.abs(composedSpendSum(parts) - headline) < 1e-9,
						`headline ${headline} summed to ${composedSpendSum(parts)}`,
					);
				}
			}
		}
	});
});

describe("annualizeWindowTotal", () => {
	it("turns a 6-month $30,000 window into a $60,000 year", () => {
		assert.equal(annualizeWindowTotal(30_000, 6), 60_000);
		assert.equal(monthlyAmountFromWindowTotal(30_000, 6), 5_000);
	});

	it("keeps a full-year window as a full year", () => {
		assert.equal(annualizeWindowTotal(60_000, 12), 60_000);
		assert.equal(monthlyAmountFromWindowTotal(60_000, 12), 5_000);
	});
});
