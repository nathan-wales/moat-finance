import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLatestOfficialSocialSecurityLimits } from "@moat/domain/federal-rules";
import { socialSecurityFraHelpText } from "./social-security-help";

describe("socialSecurityFraHelpText", () => {
	it("recommends the typical default when income is unknown", () => {
		const text = socialSecurityFraHelpText({
			annualIncome: 0,
			person: "primary",
		});
		assert.match(text, /full retirement age/);
		assert.match(text, /\$2,400\/mo is a typical starting point/);
	});

	it("uses the spouse typical default when spouse income is unknown", () => {
		const text = socialSecurityFraHelpText({
			annualIncome: 0,
			person: "spouse",
		});
		assert.match(text, /\$1,800\/mo is a typical starting point/);
	});

	it("recommends an income-based estimate in the typical range", () => {
		const text = socialSecurityFraHelpText({
			annualIncome: 60_000,
			person: "primary",
		});
		assert.match(text, /Based on your income, about \$2,300\/mo/);
		assert.doesNotMatch(text, /lower-earner|higher-earner|maximum benefit/);
	});

	it("advises the lower-earner range when income is well below typical", () => {
		const text = socialSecurityFraHelpText({
			annualIncome: 20_000,
			person: "primary",
		});
		assert.match(text, /\$2,400\/mo is typical/);
		assert.match(text, /lower-earner range/);
		assert.match(text, /about \$1,300\/mo/);
	});

	it("advises the higher-earner range when income is well above typical", () => {
		const text = socialSecurityFraHelpText({
			annualIncome: 120_000,
			person: "primary",
		});
		assert.match(text, /higher-earner range/);
		assert.match(text, /your income/);
	});

	it("advises near the maximum when income is at the wage base", () => {
		const wageBase = getLatestOfficialSocialSecurityLimits().taxableWageBase;
		const text = socialSecurityFraHelpText({
			annualIncome: wageBase,
			person: "primary",
		});
		assert.match(text, /near the maximum benefit/);
	});

	it("attributes the estimate to spouse income for the spouse field", () => {
		const text = socialSecurityFraHelpText({
			annualIncome: 20_000,
			person: "spouse",
		});
		assert.match(text, /\$1,800\/mo is typical/);
		assert.match(text, /your spouse's income/);
		assert.match(text, /lower-earner range/);
	});
});
