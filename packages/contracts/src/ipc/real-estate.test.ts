import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CreateRealEstateInputSchema,
	UpdateRealEstateInputSchema,
} from "./real-estate";

const requiredCreateFields = {
	currentEstimatedValue: 500_000,
	currentLoanBalance: 200_000,
	name: "Lake House",
	propertyType: "SINGLE_FAMILY" as const,
	usageType: "PRIMARY_RESIDENCE" as const,
};

describe("CreateRealEstateInputSchema", () => {
	it("accepts null for optional numeric fields like appreciationRate and remainingTermMonths", () => {
		const parsed = CreateRealEstateInputSchema.parse({
			...requiredCreateFields,
			appreciationRate: null,
			remainingTermMonths: null,
		});
		assert.equal(parsed.appreciationRate, null);
		assert.equal(parsed.remainingTermMonths, null);
	});

	it("still requires name, currentEstimatedValue, and currentLoanBalance", () => {
		assert.throws(() =>
			CreateRealEstateInputSchema.parse({
				currentEstimatedValue: 500_000,
				currentLoanBalance: 200_000,
				propertyType: "SINGLE_FAMILY",
				usageType: "PRIMARY_RESIDENCE",
			}),
		);
		assert.throws(() =>
			CreateRealEstateInputSchema.parse({
				currentLoanBalance: 200_000,
				name: "Lake House",
				propertyType: "SINGLE_FAMILY",
				usageType: "PRIMARY_RESIDENCE",
			}),
		);
		assert.throws(() =>
			CreateRealEstateInputSchema.parse({
				currentEstimatedValue: 500_000,
				name: "Lake House",
				propertyType: "SINGLE_FAMILY",
				usageType: "PRIMARY_RESIDENCE",
			}),
		);
	});
});

describe("UpdateRealEstateInputSchema", () => {
	it("accepts null appreciationRate as a cleared household-default override", () => {
		const parsed = UpdateRealEstateInputSchema.parse({
			appreciationRate: null,
			id: "property-1",
		});
		assert.equal(parsed.appreciationRate, null);
	});

	it("keeps a numeric appreciationRate distinct from null", () => {
		const parsed = UpdateRealEstateInputSchema.parse({
			appreciationRate: 0,
			id: "property-1",
		});
		assert.equal(parsed.appreciationRate, 0);
	});

	it("accepts null for optional numeric fields Edit plan can leave empty", () => {
		const parsed = UpdateRealEstateInputSchema.parse({
			expenseGrowthRate: null,
			id: "property-1",
			interestRate: null,
			loanTermYears: null,
			monthlyMortgagePayment: null,
			monthlyRent: null,
			remainingTermMonths: null,
			totalMonthlyExpenses: null,
			vacancyRate: null,
		});
		assert.equal(parsed.expenseGrowthRate, null);
		assert.equal(parsed.interestRate, null);
		assert.equal(parsed.loanTermYears, null);
		assert.equal(parsed.monthlyMortgagePayment, null);
		assert.equal(parsed.monthlyRent, null);
		assert.equal(parsed.remainingTermMonths, null);
		assert.equal(parsed.totalMonthlyExpenses, null);
		assert.equal(parsed.vacancyRate, null);
	});

	it("still requires currentEstimatedValue to be a number when present", () => {
		assert.throws(() =>
			UpdateRealEstateInputSchema.parse({
				currentEstimatedValue: null,
				id: "property-1",
			}),
		);
	});
});
