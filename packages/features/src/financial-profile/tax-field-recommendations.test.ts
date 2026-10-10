import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTaxFieldRecommendations } from "./tax-field-recommendations";

const baseFields = [
	{ name: "taxYear", label: "Tax year", type: "number" as const },
	{
		name: "estimatedFederalTaxBracket",
		label: "Federal bracket",
		type: "text" as const,
	},
	{
		name: "totalAnnualIncome",
		label: "Total annual income",
		type: "number" as const,
	},
	{
		name: "selfEmployedIncome",
		label: "Self-employed income",
		type: "checkbox" as const,
	},
	{ name: "filingStatus", label: "Filing status", type: "select" as const },
];

describe("withTaxFieldRecommendations", () => {
	it("omits income hints when insights have no annual income", () => {
		const fields = withTaxFieldRecommendations(baseFields, {
			taxYear: 2026,
			estimatedFederalTaxBracket: "",
			totalAnnualIncome: 0,
			taxableIncomeEstimate: 0,
			selfEmployedIncome: false,
			rentalIncome: false,
		});
		const byName = new Map(fields.map((field) => [field.name, field]));
		assert.equal(byName.get("taxYear")?.recommendation, "2026");
		assert.equal(
			byName.get("estimatedFederalTaxBracket")?.recommendation,
			undefined,
		);
		assert.equal(byName.get("totalAnnualIncome")?.recommendation, undefined);
		assert.equal(byName.get("selfEmployedIncome")?.recommendation, "No");
		assert.equal(byName.get("filingStatus")?.recommendation, undefined);
	});

	it("hides the hint when the current value already matches", () => {
		const [incomeField] = withTaxFieldRecommendations(
			[
				{
					name: "totalAnnualIncome",
					label: "Total annual income",
					type: "number",
				},
			],
			{
				taxYear: 2026,
				estimatedFederalTaxBracket: "12%",
				totalAnnualIncome: 60_000,
				taxableIncomeEstimate: 43_900,
				selfEmployedIncome: false,
				rentalIncome: false,
			},
		);
		assert.equal(incomeField?.recommendation, "$60,000");
		assert.equal(incomeField?.recommendedValue, 60_000);
		assert.equal(
			incomeField?.recommendationHelpText?.includes("connected accounts"),
			true,
		);
		assert.equal(incomeField?.matchesRecommendation?.(60_000), true);
		assert.equal(incomeField?.matchesRecommendation?.(80_000), false);
	});
});
