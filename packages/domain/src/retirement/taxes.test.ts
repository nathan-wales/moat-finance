import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateAnnualTax, marginalFederalRate } from "./taxes";

describe("estimateAnnualTax", () => {
	it("reports a 0% marginal rate when taxable income is empty", () => {
		const result = estimateAnnualTax({
			ordinaryIncome: 0,
			capitalGains: 0,
			socialSecurityBenefit: 0,
			filingStatus: "marriedJoint",
			stateTaxRate: 0.05,
			primaryAge: 32,
			spouseAge: 31,
			taxYear: 2026,
			inflationRate: 0,
		});
		assert.equal(result.totalTax, 0);
		assert.equal(result.taxableIncome, 0);
		assert.equal(result.marginalRate, 0);
	});

	it("does not treat the standard deduction as the 10% bracket", () => {
		const result = estimateAnnualTax({
			ordinaryIncome: 10_000,
			capitalGains: 0,
			socialSecurityBenefit: 0,
			filingStatus: "single",
			stateTaxRate: 0.05,
			primaryAge: 40,
			spouseAge: null,
			taxYear: 2026,
			inflationRate: 0,
		});
		assert.equal(result.totalTax, 0);
		assert.equal(result.marginalRate, 0);
	});

	it("adds the state rate once ordinary income is actually taxed", () => {
		const result = estimateAnnualTax({
			ordinaryIncome: 50_000,
			capitalGains: 0,
			socialSecurityBenefit: 0,
			filingStatus: "single",
			stateTaxRate: 0.05,
			primaryAge: 40,
			spouseAge: null,
			taxYear: 2026,
			inflationRate: 0,
		});
		assert.ok(result.totalTax > 0);
		assert.equal(result.marginalRate, 0.12 + 0.05);
	});
});

describe("marginalFederalRate", () => {
	it("returns 0% at zero taxable income", () => {
		assert.equal(
			marginalFederalRate({
				taxableIncome: 0,
				filingStatus: "marriedJoint",
				taxYear: 2026,
				inflationRate: 0,
			}),
			0,
		);
	});
});
