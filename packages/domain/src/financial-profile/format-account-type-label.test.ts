import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAccountTypeLabel } from "./format-account-type-label";

describe("formatAccountTypeLabel", () => {
	it("title-cases ordinary Plaid subtypes", () => {
		assert.equal(formatAccountTypeLabel("brokerage"), "Brokerage");
		assert.equal(formatAccountTypeLabel("crypto exchange"), "Crypto Exchange");
		assert.equal(formatAccountTypeLabel("mutual fund"), "Mutual Fund");
		assert.equal(formatAccountTypeLabel("checking"), "Checking");
	});

	it("uppercases IRA and other financial acronyms", () => {
		assert.equal(formatAccountTypeLabel("ira"), "IRA");
		assert.equal(formatAccountTypeLabel("hsa"), "HSA");
		assert.equal(formatAccountTypeLabel("sep ira"), "SEP IRA");
		assert.equal(formatAccountTypeLabel("simple ira"), "SIMPLE IRA");
	});

	it("maps Roth Plaid subtypes to Roth IRA", () => {
		assert.equal(formatAccountTypeLabel("roth"), "Roth IRA");
		assert.equal(formatAccountTypeLabel("roth ira"), "Roth IRA");
		assert.equal(formatAccountTypeLabel("roth 401k"), "Roth 401(k)");
	});

	it("formats retirement plan numbers", () => {
		assert.equal(formatAccountTypeLabel("401k"), "401(k)");
		assert.equal(formatAccountTypeLabel("roth 401k"), "Roth 401(k)");
	});

	it("returns undefined for blank values", () => {
		assert.equal(formatAccountTypeLabel(null), undefined);
		assert.equal(formatAccountTypeLabel("   "), undefined);
	});
});
