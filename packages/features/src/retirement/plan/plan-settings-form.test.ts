import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyLinkedIncomeSplit,
	incomeSplitForForm,
	parsePlanSettingsForm,
} from "./plan-settings-form";

describe("incomeSplitForForm", () => {
	it("puts the full Insights total on the primary when no split is stored", () => {
		assert.deepEqual(
			incomeSplitForForm({
				hasSpouse: true,
				total: 260_023,
			}),
			{ primary: "260023", spouse: "0" },
		);
	});

	it("keeps a stored split that already matches the total", () => {
		assert.deepEqual(
			incomeSplitForForm({
				hasSpouse: true,
				storedPrimary: 150_000,
				storedSpouse: 110_023,
				total: 260_023,
			}),
			{ primary: "150000", spouse: "110023" },
		);
	});
});

describe("applyLinkedIncomeSplit", () => {
	it("moves the remainder to the spouse when primary income is reduced", () => {
		assert.deepEqual(
			applyLinkedIncomeSplit({
				edited: "primary",
				raw: "150000",
				total: 260_023,
			}),
			{
				primaryEmploymentIncome: "150000",
				spouseEmploymentIncome: "110023",
			},
		);
	});

	it("moves the remainder to the primary when spouse income is increased", () => {
		assert.deepEqual(
			applyLinkedIncomeSplit({
				edited: "spouse",
				raw: "40000",
				total: 260_023,
			}),
			{
				primaryEmploymentIncome: "220023",
				spouseEmploymentIncome: "40000",
			},
		);
	});

	it("clamps an amount above the total", () => {
		assert.deepEqual(
			applyLinkedIncomeSplit({
				edited: "spouse",
				raw: "500000",
				total: 260_023,
			}),
			{
				primaryEmploymentIncome: "0",
				spouseEmploymentIncome: "260023",
			},
		);
	});

	it("treats a cleared field as zero and gives the other person the full total", () => {
		assert.deepEqual(
			applyLinkedIncomeSplit({
				edited: "primary",
				raw: "",
				total: 260_023,
			}),
			{
				primaryEmploymentIncome: "",
				spouseEmploymentIncome: "260023",
			},
		);
	});
});

describe("parsePlanSettingsForm", () => {
	it("persists the income split when a spouse is included", () => {
		const parsed = parsePlanSettingsForm({
			hasSpouse: true,
			longevityAge: "95",
			primaryBirthYear: "1985",
			primaryEmploymentIncome: "150,000",
			socialSecurityClaimAge: "67",
			socialSecurityMonthlyAtFra: "2400",
			spouseBirthYear: "1987",
			spouseEmploymentIncome: "110,023",
			spouseLongevityAge: "95",
			spouseRetirementAge: "65",
			spouseSocialSecurityClaimAge: "67",
			spouseSocialSecurityMonthlyAtFra: "1800",
			targetRetirementAge: "65",
		});
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.value.annualEmploymentIncome, 150_000);
		assert.equal(parsed.value.annualSpouseEmploymentIncome, 110_023);
	});

	it("clears the stored split when a spouse is not included", () => {
		const parsed = parsePlanSettingsForm({
			hasSpouse: false,
			longevityAge: "95",
			primaryBirthYear: "1985",
			primaryEmploymentIncome: "260023",
			socialSecurityClaimAge: "67",
			socialSecurityMonthlyAtFra: "",
			spouseBirthYear: "",
			spouseEmploymentIncome: "0",
			spouseLongevityAge: "",
			spouseRetirementAge: "",
			spouseSocialSecurityClaimAge: "",
			spouseSocialSecurityMonthlyAtFra: "",
			targetRetirementAge: "65",
		});
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.value.annualEmploymentIncome, null);
		assert.equal(parsed.value.annualSpouseEmploymentIncome, null);
	});
});
