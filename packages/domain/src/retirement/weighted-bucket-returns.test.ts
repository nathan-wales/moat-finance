import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type RetirementAccountSource,
	toRetirementAccountSourceFromPlaid,
} from "@moat/data-access";
import { weightedBucketReturns, weightedCashYield } from "./build-baseline";

function account(
	overrides: Partial<RetirementAccountSource>,
): RetirementAccountSource {
	return {
		id: "acct",
		name: "Account",
		origin: "plaid",
		kind: "brokerage",
		taxTreatment: "taxable",
		balance: 0,
		monthlyContribution: 0,
		annualReturnRate: 0.07,
		isCash: false,
		isDebt: false,
		forecastInputsUserEdited: false,
		...overrides,
	};
}

describe("weightedBucketReturns", () => {
	it("weights Roth and brokerage returns separately and falls back for empty buckets", () => {
		const rates = weightedBucketReturns(
			[
				account({
					id: "roth",
					kind: "roth",
					taxTreatment: "taxFree",
					balance: 10_000,
					annualReturnRate: 0.1,
				}),
				account({
					id: "brokerage",
					kind: "brokerage",
					taxTreatment: "taxable",
					balance: 30_000,
					annualReturnRate: 0.07,
				}),
			],
			0.05,
		);
		assert.equal(rates.taxFree, 0.1);
		assert.equal(rates.taxable, 0.07);
		assert.equal(rates.taxDeferred, 0.05);
	});
});

describe("weightedCashYield", () => {
	it("blends user-set checking and savings rates by current balance", () => {
		const yieldRate = weightedCashYield(
			[
				account({
					id: "wf",
					kind: "checking",
					isCash: true,
					balance: 30_000,
					annualReturnRate: 0.0001,
					forecastInputsUserEdited: true,
				}),
				account({
					id: "hysa",
					kind: "savings",
					isCash: true,
					balance: 10_000,
					annualReturnRate: 0.03,
					forecastInputsUserEdited: true,
				}),
			],
			0.045,
		);
		assert.ok(
			Math.abs(yieldRate - (30_000 * 0.0001 + 10_000 * 0.03) / 40_000) < 1e-12,
		);
	});

	it("falls back to household cash yield when no cash rate is user-set", () => {
		const yieldRate = weightedCashYield(
			[
				account({
					id: "wf",
					kind: "checking",
					isCash: true,
					balance: 38_788,
					annualReturnRate: 0.07,
					forecastInputsUserEdited: false,
				}),
			],
			0.045,
		);
		assert.equal(yieldRate, 0.045);
	});
});

describe("toRetirementAccountSourceFromPlaid", () => {
	it("does not treat the Plaid schema default 0.07 as a cash yield", () => {
		const source = toRetirementAccountSourceFromPlaid({
			id: "chk",
			name: "Wells Fargo Checking",
			type: "depository",
			subtype: "checking",
			currentBalance: 20_000,
			availableBalance: 20_000,
			annualReturnRate: 0.07,
			forecastInputsUserEdited: false,
		});
		assert.equal(source.isCash, true);
		assert.equal(source.forecastInputsUserEdited, false);
		assert.equal(source.annualReturnRate, 0);
	});

	it("keeps a user-set checking rate", () => {
		const source = toRetirementAccountSourceFromPlaid({
			id: "hysa",
			name: "HYSA",
			type: "depository",
			subtype: "savings",
			currentBalance: 10_000,
			availableBalance: 10_000,
			annualReturnRate: 0.03,
			forecastInputsUserEdited: true,
		});
		assert.equal(source.isCash, true);
		assert.equal(source.annualReturnRate, 0.03);
		assert.equal(source.forecastInputsUserEdited, true);
	});
});
