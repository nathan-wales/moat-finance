import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FinancialProfileData, TaxProfile } from "@moat/contracts";
import {
	applyTaxProfileDefaults,
	stripTaxProfileRecommendations,
	type TaxIncomeTransaction,
} from "./apply-tax-profile-defaults";

const NOW = new Date("2026-09-09T12:00:00.000Z");

function taxProfile(overrides: Partial<TaxProfile> = {}): TaxProfile {
	return {
		filingStatus: "Single",
		taxYear: 2026,
		estimatedFederalTaxBracket: "",
		estimatedStateTaxRate: "",
		totalAnnualIncome: 0,
		taxableIncomeEstimate: 0,
		deductionStrategy: "Standard",
		selfEmployedIncome: false,
		rentalIncome: false,
		lastUpdated: "2026-01-01",
		...overrides,
	};
}

function monthlyIncome(
	overrides: Partial<TaxIncomeTransaction> = {},
): TaxIncomeTransaction {
	return {
		amount: 5_000,
		date: new Date("2026-08-01T00:00:00.000Z"),
		category: "Paycheck",
		description: "Employer payroll",
		merchantName: null,
		...overrides,
	};
}

describe("applyTaxProfileDefaults", () => {
	it("seeds empty estimate fields from income and does not bump lastUpdated", () => {
		const result = applyTaxProfileDefaults({
			taxProfile: taxProfile(),
			location: "Texas",
			incomeTransactions: [
				monthlyIncome({ date: new Date("2026-07-01T00:00:00.000Z") }),
				monthlyIncome({ date: new Date("2026-08-01T00:00:00.000Z") }),
			],
			now: NOW,
		});

		assert.equal(result.taxProfile.totalAnnualIncome, 60_000);
		assert.equal(result.taxProfile.taxableIncomeEstimate, 43_900);
		assert.equal(result.taxProfile.estimatedFederalTaxBracket, "12%");
		assert.equal(result.taxProfile.estimatedStateTaxRate, "0%");
		assert.equal(result.taxProfile.lastUpdated, "2026-01-01");
		assert.equal(result.recommendations.totalAnnualIncome, 60_000);
		assert.equal(result.recommendations.estimatedFederalTaxBracket, "12%");
	});

	it("keeps saved estimate fields and still returns live recommendations", () => {
		const result = applyTaxProfileDefaults({
			taxProfile: taxProfile({
				estimatedFederalTaxBracket: "24%",
				estimatedStateTaxRate: "4.55%",
				totalAnnualIncome: 180_000,
				taxableIncomeEstimate: 150_000,
				taxYear: 2025,
			}),
			location: "Texas",
			incomeTransactions: [
				monthlyIncome({ date: new Date("2026-07-01T00:00:00.000Z") }),
				monthlyIncome({ date: new Date("2026-08-01T00:00:00.000Z") }),
			],
			now: NOW,
		});

		assert.equal(result.taxProfile.totalAnnualIncome, 180_000);
		assert.equal(result.taxProfile.taxableIncomeEstimate, 150_000);
		assert.equal(result.taxProfile.estimatedFederalTaxBracket, "24%");
		assert.equal(result.taxProfile.estimatedStateTaxRate, "4.55%");
		assert.equal(result.taxProfile.taxYear, 2025);
		assert.equal(result.recommendations.totalAnnualIncome, 60_000);
		assert.equal(result.recommendations.estimatedFederalTaxBracket, "12%");
		assert.equal(result.recommendations.taxYear, 2026);
	});

	it("does not force self-employed or rental flags after estimates are saved", () => {
		const result = applyTaxProfileDefaults({
			taxProfile: taxProfile({
				estimatedFederalTaxBracket: "22%",
				totalAnnualIncome: 80_000,
				taxableIncomeEstimate: 60_000,
				selfEmployedIncome: false,
				rentalIncome: false,
			}),
			location: "Denver, CO",
			incomeTransactions: [
				monthlyIncome({
					description: "1099 consulting",
					merchantName: "Freelance LLC",
				}),
				monthlyIncome({
					date: new Date("2026-07-01T00:00:00.000Z"),
					description: "rental income",
				}),
			],
			now: NOW,
		});

		assert.equal(result.taxProfile.selfEmployedIncome, false);
		assert.equal(result.taxProfile.rentalIncome, false);
		assert.equal(result.recommendations.selfEmployedIncome, true);
		assert.equal(result.recommendations.rentalIncome, true);
	});

	it("seeds self-employed and rental flags only when estimates are still unset", () => {
		const result = applyTaxProfileDefaults({
			taxProfile: taxProfile(),
			location: "Denver, CO",
			incomeTransactions: [
				monthlyIncome({ description: "1099 consulting" }),
				monthlyIncome({
					date: new Date("2026-07-01T00:00:00.000Z"),
					description: "rental income",
				}),
			],
			now: NOW,
		});

		assert.equal(result.taxProfile.selfEmployedIncome, true);
		assert.equal(result.taxProfile.rentalIncome, true);
	});
});

describe("stripTaxProfileRecommendations", () => {
	it("drops computed recommendations before persist", () => {
		const data = {
			taxProfile: taxProfile(),
			taxProfileRecommendations: {
				taxYear: 2026,
				estimatedFederalTaxBracket: "12%",
				totalAnnualIncome: 60_000,
				taxableIncomeEstimate: 43_900,
				selfEmployedIncome: false,
				rentalIncome: false,
			},
		} as FinancialProfileData;

		const stripped = stripTaxProfileRecommendations(data);
		assert.equal(stripped.taxProfileRecommendations, undefined);
		assert.equal(stripped.taxProfile.taxYear, 2026);
	});
});
