import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	calcMonthlyPayment,
	calculateRealEstateProjection,
	type RealEstateInputs,
} from "./real-estate-projection";

const approxEqual = (actual: number, expected: number, epsilon = 0.01) => {
	assert.ok(
		Math.abs(actual - expected) <= epsilon,
		`expected ${actual} to be within ${epsilon} of ${expected}`,
	);
};

function baseInputs(
	overrides: Partial<RealEstateInputs> = {},
): RealEstateInputs {
	const interestRate = 0.065;
	const remainingTermMonths = 360;
	const currentLoanBalance = 510_000;
	return {
		currentEstimatedValue: 600_000,
		currentLoanBalance,
		monthlyRent: 1_650,
		totalMonthlyExpenses: 570,
		interestRate,
		remainingTermMonths,
		monthlyMortgagePayment: calcMonthlyPayment(
			currentLoanBalance,
			interestRate,
			remainingTermMonths,
		),
		vacancyRate: 0.05,
		appreciationRate: 0.03,
		expenseGrowthRate: 0.02,
		...overrides,
	};
}

describe("calculateRealEstateProjection invariants", () => {
	it("uses current equity as the investment basis and reconciles gains", () => {
		const property = baseInputs();
		const points = calculateRealEstateProjection(property, "STANDARD", 5);
		const year5 = points[4];
		assert.ok(year5);

		const startingEquity =
			property.currentEstimatedValue - property.currentLoanBalance;
		assert.equal(startingEquity, 90_000);
		assert.equal(year5.totalCashInvested, startingEquity);

		const endingEquity =
			year5.projectedPropertyValue - year5.projectedLoanBalance;
		assert.equal(year5.projectedEquity, endingEquity);

		const equityGain = endingEquity - startingEquity;
		const summedEquityIncreases = points.reduce(
			(sum, point) => sum + point.equityIncreaseThisYear,
			0,
		);
		approxEqual(equityGain, summedEquityIncreases);
		approxEqual(equityGain, year5.cumulativeNetGain - year5.cumulativeCashFlow);

		const appreciationGain =
			year5.projectedPropertyValue - property.currentEstimatedValue;
		const principalPaidDown =
			property.currentLoanBalance - year5.projectedLoanBalance;
		approxEqual(appreciationGain, year5.cumulativeAppreciation);
		approxEqual(principalPaidDown, year5.cumulativePrincipalPaidDown);
		approxEqual(equityGain, appreciationGain + principalPaidDown, 0.02);

		const fiveYearNetGain = equityGain + year5.cumulativeCashFlow;
		approxEqual(fiveYearNetGain, year5.cumulativeNetGain);
		assert.ok(year5.roiPercent !== null);
		approxEqual(year5.roiPercent, (fiveYearNetGain / startingEquity) * 100);
		assert.equal(year5.roiPercent, year5.cumulativeROI);
	});

	it("returns null ROI when starting equity is zero or negative", () => {
		const zeroEquity = calculateRealEstateProjection(
			baseInputs({
				currentEstimatedValue: 510_000,
				currentLoanBalance: 510_000,
			}),
			"STANDARD",
			5,
		);
		assert.equal(zeroEquity[4]?.roiPercent, null);

		const negativeEquity = calculateRealEstateProjection(
			baseInputs({
				currentEstimatedValue: 400_000,
				currentLoanBalance: 510_000,
			}),
			"STANDARD",
			5,
		);
		assert.equal(negativeEquity[4]?.roiPercent, null);
	});

	it("zero-growth scenario grows equity only via principal paydown", () => {
		const property = baseInputs({
			appreciationRate: 0,
			expenseGrowthRate: 0,
			rentGrowthRate: 0,
			vacancyRate: 0,
			monthlyRent: 3_500,
		});
		const points = calculateRealEstateProjection(property, "STANDARD", 5);
		const year5 = points[4];
		assert.ok(year5);

		const startingEquity =
			property.currentEstimatedValue - property.currentLoanBalance;
		assert.equal(year5.cumulativeAppreciation, 0);
		approxEqual(year5.projectedPropertyValue, property.currentEstimatedValue);
		assert.ok(year5.cumulativePrincipalPaidDown > 0);
		approxEqual(
			year5.projectedEquity - startingEquity,
			year5.cumulativePrincipalPaidDown,
		);

		const summedEquityIncreases = points.reduce(
			(sum, point) => sum + point.equityIncreaseThisYear,
			0,
		);
		approxEqual(summedEquityIncreases, year5.cumulativePrincipalPaidDown);
	});

	it("never lets loan balance fall below zero and handles payoff", () => {
		const property = baseInputs({
			currentLoanBalance: 5_000,
			monthlyMortgagePayment: 2_000,
			interestRate: 0.05,
			remainingTermMonths: 12,
			appreciationRate: 0,
		});
		const points = calculateRealEstateProjection(property, "STANDARD", 5);
		for (const point of points) {
			assert.ok(point.projectedLoanBalance >= 0);
		}
		assert.equal(points[4]?.projectedLoanBalance, 0);
	});

	it("does not double-count appreciation or principal in ROI", () => {
		const property = baseInputs({ appreciationRate: 0.03 });
		const year5 = calculateRealEstateProjection(property, "STANDARD", 5)[4];
		assert.ok(year5);

		const startingEquity =
			property.currentEstimatedValue - property.currentLoanBalance;
		const equityGain = year5.projectedEquity - startingEquity;
		const wrongDoubleCounted =
			equityGain +
			year5.cumulativeAppreciation +
			year5.cumulativePrincipalPaidDown +
			year5.cumulativeCashFlow;

		assert.notEqual(year5.cumulativeNetGain, wrongDoubleCounted);
		approxEqual(year5.cumulativeNetGain, equityGain + year5.cumulativeCashFlow);
	});
});
