import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertOfficialRulesPublishedOnSchedule,
	contributionLimitsForYear,
	estimatedBusinessMileageDeductionCents,
	getBusinessStandardMileageRate,
	getEmployeeDeferralLimit,
	getHsaContributionLimit,
	getHsaLimits,
	getIraContributionLimit,
	getIraLimits,
	getTaxYear,
	officialYearsPresent,
	openContributionYears,
} from "./index";

describe("getTaxYear", () => {
	it("flips on January 1", () => {
		assert.equal(getTaxYear(new Date(Date.UTC(2026, 11, 31))), 2026);
		assert.equal(getTaxYear(new Date(Date.UTC(2027, 0, 1))), 2027);
	});
});

describe("openContributionYears", () => {
	it("includes the prior year through April 15", () => {
		assert.deepEqual(
			openContributionYears(new Date(Date.UTC(2027, 3, 15))),
			[2026, 2027],
		);
		assert.deepEqual(
			openContributionYears(new Date(Date.UTC(2027, 3, 16))),
			[2027],
		);
	});
});

describe("official HSA / IRA lookups", () => {
	it("returns historical and published future HSA figures", () => {
		assert.equal(getHsaLimits(2025).selfOnly, 4_300);
		assert.equal(getHsaLimits(2026).selfOnly, 4_400);
		assert.equal(getHsaLimits(2026).family, 8_750);
		const hsa2027 = getHsaLimits(2027);
		assert.equal(hsa2027.selfOnly, 4_500);
		assert.equal(hsa2027.family, 9_000);
		assert.equal(hsa2027.status, "official");
	});

	it("marks IRA 2027 as estimated from 2026", () => {
		const ira2026 = getIraLimits(2026);
		assert.equal(ira2026.contribution, 7_500);
		assert.equal(ira2026.status, "official");

		const ira2027 = getIraLimits(2027, 0.03);
		assert.equal(ira2027.status, "estimated");
		assert.equal(ira2027.basisYear, 2026);
		assert.ok(ira2027.contribution >= 7_500);
	});

	it("applies age-55 HSA catch-up", () => {
		assert.equal(
			getHsaContributionLimit({
				taxYear: 2026,
				age: 54,
				coverage: "self",
			}).amount,
			4_400,
		);
		assert.equal(
			getHsaContributionLimit({
				taxYear: 2026,
				age: 55,
				coverage: "self",
			}).amount,
			5_400,
		);
	});
});

describe("super catch-up", () => {
	it("uses ordinary catch-up at 59 and 64, super at 60–63", () => {
		assert.equal(
			getEmployeeDeferralLimit({ taxYear: 2026, age: 59 }).amount,
			24_500 + 8_000,
		);
		assert.equal(
			getEmployeeDeferralLimit({ taxYear: 2026, age: 60 }).amount,
			24_500 + 11_250,
		);
		assert.equal(
			getEmployeeDeferralLimit({ taxYear: 2026, age: 63 }).amount,
			24_500 + 11_250,
		);
		assert.equal(
			getEmployeeDeferralLimit({ taxYear: 2026, age: 64 }).amount,
			24_500 + 8_000,
		);
	});
});

describe("contributionLimitsForYear", () => {
	it("can mix official HSA with estimated IRA in the same year", () => {
		const limits = contributionLimitsForYear(2027, 0.03);
		assert.equal(limits.hsaSelf, 4_500);
		const ira = getIraLimits(2027, 0.03);
		assert.equal(ira.status, "estimated");
		assert.equal(limits.ira, ira.contribution);
	});

	it("indexes far-future workplace limits above the 2026 base", () => {
		const year20 = contributionLimitsForYear(2046, 0.03);
		assert.ok(year20.employee401k > 24_500);
		assert.ok(year20.ira > 7_500);
	});
});

describe("calendar reminder", () => {
	it("requires 2027 HSA by late August 2026 but not yet 2027 IRA", () => {
		const asOf = new Date(Date.UTC(2026, 7, 29));
		assert.doesNotThrow(() => assertOfficialRulesPublishedOnSchedule(asOf));
		const years = officialYearsPresent();
		assert.ok(years.hsa.includes(2027));
		assert.ok(!years.ira.includes(2027));
	});

	it("fails after Nov 20 if next-year retirement rows are missing", () => {
		const asOf = new Date(Date.UTC(2026, 10, 21));
		assert.throws(
			() => assertOfficialRulesPublishedOnSchedule(asOf),
			/Federal tax tables for 2027|IRA limits for 2027|Workplace retirement limits for 2027|Social Security wage base for 2027/,
		);
	});
});

describe("getIraContributionLimit", () => {
	it("adds catch-up at 50", () => {
		assert.equal(
			getIraContributionLimit({ taxYear: 2026, age: 49 }).amount,
			7_500,
		);
		assert.equal(
			getIraContributionLimit({ taxYear: 2026, age: 50 }).amount,
			8_600,
		);
	});
});

describe("business standard mileage rates", () => {
	it("uses the rate in effect on the trip date, including mid-year changes", () => {
		assert.equal(
			getBusinessStandardMileageRate(new Date(Date.UTC(2026, 5, 30)))
				.centsPerMile,
			72.5,
		);
		assert.equal(
			getBusinessStandardMileageRate(new Date(Date.UTC(2026, 6, 1)))
				.centsPerMile,
			76,
		);
		assert.equal(
			getBusinessStandardMileageRate(new Date(Date.UTC(2022, 5, 30)))
				.centsPerMile,
			58.5,
		);
		assert.equal(
			getBusinessStandardMileageRate(new Date(Date.UTC(2022, 6, 1)))
				.centsPerMile,
			62.5,
		);
	});

	it("estimates deduction from path distance and the date-specific rate", () => {
		const fiveMilesInMeters = 5 * 1609.344;
		assert.equal(
			estimatedBusinessMileageDeductionCents(
				fiveMilesInMeters,
				new Date(Date.UTC(2026, 0, 15)),
			),
			363,
		);
		assert.equal(
			estimatedBusinessMileageDeductionCents(
				fiveMilesInMeters,
				new Date(Date.UTC(2026, 7, 15)),
			),
			380,
		);
	});
});
