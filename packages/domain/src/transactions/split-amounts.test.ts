import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	amountToCents,
	splitAmountsMatchOriginal,
	splitRemainderCents,
	sumLegCents,
} from "./split-amounts";

describe("split-amounts", () => {
	it("converts amounts to cents without floating error", () => {
		assert.equal(amountToCents(10.1), 1010);
		assert.equal(amountToCents(0.1 + 0.2), 30);
	});

	it("sums legs in cents", () => {
		assert.equal(sumLegCents([{ amount: 60.1 }, { amount: 39.9 }]), 10000);
	});

	it("reports remainder until legs cover the original", () => {
		assert.equal(
			splitRemainderCents(100, [{ amount: 40 }, { amount: 25 }]),
			3500,
		);
		assert.equal(splitRemainderCents(100, [{ amount: 60 }, { amount: 40 }]), 0);
	});

	it("requires an exact cents match", () => {
		assert.equal(
			splitAmountsMatchOriginal(163.18, [
				{ amount: 27.93 },
				{ amount: 17.18 },
				{ amount: 118.07 },
			]),
			true,
		);
		assert.equal(
			splitAmountsMatchOriginal(100, [{ amount: 50 }, { amount: 49.99 }]),
			false,
		);
	});
});
