import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProfileAsset, ProfileLiability } from "@moat/contracts";
import {
	mergeMortgageLiabilities,
	mergeRealEstateAssets,
	mortgageLiabilityId,
	type RealEstateForProfileMerge,
	realEstateAssetId,
} from "./merge-real-estate-into-profile";

function property(
	overrides: Partial<RealEstateForProfileMerge> &
		Pick<RealEstateForProfileMerge, "id" | "name">,
): RealEstateForProfileMerge {
	return {
		currentEstimatedValue: 500_000,
		currentLoanBalance: 0,
		interestRate: null,
		remainingTermMonths: null,
		monthlyMortgagePayment: null,
		linkedPlaidAccountId: null,
		linkedPlaidAccount: null,
		...overrides,
	};
}

describe("mergeRealEstateAssets", () => {
	it("adds synced real-estate rows with real-estate- ids", () => {
		const stored: ProfileAsset[] = [
			{
				id: "vehicle-1",
				name: "Car",
				type: "Vehicle",
				estimatedValue: 12_000,
				includeInNetWorth: true,
				includeInForecast: true,
			},
		];
		const merged = mergeRealEstateAssets(stored, [
			property({ id: "prop-1", name: "Home", currentEstimatedValue: 750_000 }),
		]);

		assert.equal(merged.length, 2);
		assert.equal(merged[0]?.id, "vehicle-1");
		assert.deepEqual(merged[1], {
			id: realEstateAssetId("prop-1"),
			name: "Home",
			type: "Real estate",
			estimatedValue: 750_000,
			linkedLiability: "Home mortgage",
			linkedInsurance: undefined,
			includeInNetWorth: true,
			includeInForecast: true,
		});
	});

	it("preserves include flags from previously synced assets", () => {
		const stored: ProfileAsset[] = [
			{
				id: realEstateAssetId("prop-1"),
				name: "Old name",
				type: "Real estate",
				estimatedValue: 1,
				includeInNetWorth: false,
				includeInForecast: false,
				linkedLiability: "Custom lien",
				linkedInsurance: "Homeowners",
			},
		];
		const merged = mergeRealEstateAssets(stored, [
			property({ id: "prop-1", name: "Home", currentEstimatedValue: 800_000 }),
		]);

		assert.equal(merged.length, 1);
		assert.equal(merged[0]?.name, "Home");
		assert.equal(merged[0]?.estimatedValue, 800_000);
		assert.equal(merged[0]?.includeInNetWorth, false);
		assert.equal(merged[0]?.includeInForecast, false);
		assert.equal(merged[0]?.linkedLiability, "Custom lien");
		assert.equal(merged[0]?.linkedInsurance, "Homeowners");
	});
});

describe("mergeMortgageLiabilities", () => {
	it("creates mortgage liabilities for financed properties", () => {
		const stored: ProfileLiability[] = [];
		const merged = mergeMortgageLiabilities(stored, [
			property({
				id: "prop-1",
				name: "Home",
				currentLoanBalance: 300_000,
				interestRate: 0.065,
				monthlyMortgagePayment: 2_100,
				remainingTermMonths: 360,
			}),
		]);

		assert.equal(merged.length, 1);
		assert.equal(merged[0]?.id, mortgageLiabilityId("prop-1"));
		assert.equal(merged[0]?.type, "Mortgage");
		assert.equal(merged[0]?.balance, 300_000);
		assert.equal(merged[0]?.interestRate, 6.5);
		assert.equal(merged[0]?.monthlyPayment, 2_100);
		assert.equal(merged[0]?.linkedAsset, "Home");
		assert.equal(merged[0]?.includeInNetWorth, false);
	});

	it("uses linked Plaid account name and balance when present", () => {
		const merged = mergeMortgageLiabilities(
			[],
			[
				property({
					id: "prop-1",
					name: "Home",
					currentLoanBalance: 100,
					linkedPlaidAccountId: "acct-1",
					linkedPlaidAccount: {
						id: "acct-1",
						name: "Mortgage",
						officialName: "Primary Mortgage",
						currentBalance: -275_000,
					},
				}),
			],
		);

		assert.equal(merged[0]?.name, "Mortgage");
		assert.equal(merged[0]?.balance, 275_000);
	});
});
