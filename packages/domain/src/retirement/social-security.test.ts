import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SOCIAL_SECURITY_FRA } from "./constants";
import { spousalMonthlyBenefit } from "./social-security";

describe("spousalMonthlyBenefit", () => {
	it("pays 50% of the higher earner's PIA when that exceeds own benefit", () => {
		assert.equal(
			spousalMonthlyBenefit({
				ownMonthlyAtFra: 700,
				higherEarnerMonthlyAtFra: 2_000,
				claimAge: SOCIAL_SECURITY_FRA,
			}),
			1_000,
		);
	});

	it("does not add delayed credits to the spousal portion", () => {
		assert.equal(
			spousalMonthlyBenefit({
				ownMonthlyAtFra: 700,
				higherEarnerMonthlyAtFra: 2_000,
				claimAge: 70,
			}),
			1_000,
		);
	});
});
