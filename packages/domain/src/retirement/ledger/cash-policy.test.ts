import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCashSweep } from "./cash-policy";

const policy = {
	targetReserve: { mode: "months" as const, months: 6, amount: 0 },
	excessDestination: "cash" as const,
	rmdExcessDestination: "cash" as const,
};

describe("calculateCashSweep", () => {
	it("sweeps nothing when the destination is cash", () => {
		const sweep = calculateCashSweep({
			policy,
			endingCash: 100_000,
			annualExpenses: 60_000,
		});
		assert.equal(sweep.sweptToTaxable, 0);
		assert.equal(sweep.remainingCash, 100_000);
	});

	it("invests cash above the reserve when the destination is taxable", () => {
		const sweep = calculateCashSweep({
			policy: { ...policy, excessDestination: "taxable" },
			endingCash: 100_000,
			annualExpenses: 60_000,
		});
		assert.equal(sweep.sweptToTaxable, 70_000);
		assert.equal(sweep.remainingCash, 30_000);
	});

	it("invests RMD proceeds above the reserve without moving other cash", () => {
		const sweep = calculateCashSweep({
			policy: { ...policy, rmdExcessDestination: "taxable" },
			endingCash: 100_000,
			annualExpenses: 60_000,
			rmdAmount: 20_000,
		});
		assert.equal(sweep.sweptToTaxable, 20_000);
		assert.equal(sweep.remainingCash, 80_000);
	});
});
