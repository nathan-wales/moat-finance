import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RetirementLeverSchema } from "@moat/contracts";
import {
	annualizeInsightsEmploymentIncome,
	isRentalIncomeCategory,
	resolveEmploymentIncome,
} from "./build-baseline";
import { type DefaultLeverContext, defaultLeverFor } from "./default-lever";

const ctx: DefaultLeverContext = {
	currentAge: 45,
	retirementAge: 65,
	spouseCurrentAge: 43,
	spouseRetirementAge: 65,
	hasSpouse: true,
	annualEmploymentIncome: 120_000,
	annualSpouseEmploymentIncome: 80_000,
	expectedRetirementMonthlySpending: 7_500,
	returnRate: 0.07,
	socialSecurityClaimAge: 67,
	spouseSocialSecurityClaimAge: 67,
	rmdStartAge: 75,
	primaryPropertyId: "home",
	rentalPropertyId: null,
};

describe("resolveEmploymentIncome", () => {
	it("assigns all trailing Insights income to the primary when a spouse is present but no split is stored", () => {
		const resolved = resolveEmploymentIncome({
			hasSpouse: true,
			trailingAnnualIncome: 200_000,
		});
		assert.equal(resolved.primary, 200_000);
		assert.equal(resolved.spouse, 0);
	});

	it("assigns all trailing Insights income to the primary when there is no spouse", () => {
		const resolved = resolveEmploymentIncome({
			hasSpouse: false,
			trailingAnnualIncome: 180_000,
		});
		assert.equal(resolved.primary, 180_000);
		assert.equal(resolved.spouse, 0);
	});

	it("applies a stored split as a share of current Insights income", () => {
		const resolved = resolveEmploymentIncome({
			hasSpouse: true,
			trailingAnnualIncome: 260_000,
			storedPrimary: 150_000,
			storedSpouse: 110_000,
		});
		assert.equal(resolved.primary, 150_000);
		assert.equal(resolved.spouse, 110_000);
	});

	it("rescales a stored split when Insights income changes", () => {
		const resolved = resolveEmploymentIncome({
			hasSpouse: true,
			trailingAnnualIncome: 300_000,
			storedPrimary: 100_000,
			storedSpouse: 100_000,
		});
		assert.equal(resolved.primary, 150_000);
		assert.equal(resolved.spouse, 150_000);
	});
});

describe("annualizeInsightsEmploymentIncome", () => {
	it("annualizes a single Insights month instead of treating it as a full year", () => {
		const annual = annualizeInsightsEmploymentIncome({
			monthlyTotals: [{ income: 0 }, { income: 0 }, { income: 19_541 }],
			incomeByCategory: [{ category: "Salary", total: 19_541 }],
		});
		assert.equal(annual, 19_541 * 12);
	});

	it("does not let rental categories wipe a paycheck to zero", () => {
		const annual = annualizeInsightsEmploymentIncome({
			monthlyTotals: [{ income: 19_541 }],
			incomeByCategory: [
				{ category: "Salary", total: 17_541 },
				{ category: "Rental Income", total: 2_000 },
			],
		});
		assert.ok(annual > 200_000);
		assert.ok(Math.abs(annual - 19_541 * 12 * (17_541 / 19_541)) < 1);
	});

	it("keeps Insights investment income so employment matches the total-income card", () => {
		const annual = annualizeInsightsEmploymentIncome({
			monthlyTotals: [{ income: 0 }, { income: 19_541 }],
			incomeByCategory: [{ category: "Investments", total: 19_541 }],
		});
		assert.equal(annual, 19_541 * 12);
	});

	it("ignores expense-only months when averaging the run-rate", () => {
		const annual = annualizeInsightsEmploymentIncome({
			monthlyTotals: [
				{ income: 0 },
				{ income: 0 },
				{ income: 0 },
				{ income: 8_500 },
			],
			incomeByCategory: [{ category: "Salary", total: 8_500 }],
		});
		assert.equal(annual, 8_500 * 12);
	});
});

describe("isRentalIncomeCategory", () => {
	it("matches rental labels without treating salary as rent", () => {
		assert.equal(isRentalIncomeCategory("Rental Income"), true);
		assert.equal(isRentalIncomeCategory("Salary"), false);
	});
});

describe("defaultLeverFor", () => {
	it("builds spouse_stops_working at the spouse's current age", () => {
		const lever = defaultLeverFor("spouse_stops_working", ctx);
		assert.equal(lever.type, "spouse_stops_working");
		if (lever.type !== "spouse_stops_working") return;
		assert.equal(lever.params.atAge, 43);
	});

	it("accepts stop-working ages anywhere in 0-200", () => {
		const young = { ...ctx, currentAge: 28, spouseCurrentAge: 25 };
		const spouseStop = defaultLeverFor("spouse_stops_working", young);
		assert.equal(spouseStop.type, "spouse_stops_working");
		if (spouseStop.type !== "spouse_stops_working") return;
		assert.equal(spouseStop.params.atAge, 25);
		assert.deepEqual(RetirementLeverSchema.parse(spouseStop), spouseStop);
		assert.deepEqual(
			RetirementLeverSchema.parse({
				type: "spouse_stops_working",
				params: { atAge: 0 },
			}),
			{ type: "spouse_stops_working", params: { atAge: 0 } },
		);

		const primaryStop = defaultLeverFor("stop_working_at_age", young);
		assert.equal(primaryStop.type, "stop_working_at_age");
		if (primaryStop.type !== "stop_working_at_age") return;
		assert.equal(primaryStop.params.age, 28);
		assert.deepEqual(RetirementLeverSchema.parse(primaryStop), primaryStop);
	});

	it("builds an income cut for the primary earner", () => {
		const lever = defaultLeverFor("income_change", ctx);
		assert.equal(lever.type, "income_change");
		if (lever.type !== "income_change") return;
		assert.equal(lever.params.whom, "primary");
		assert.equal(lever.params.annualDelta, -120_000);
	});
});
