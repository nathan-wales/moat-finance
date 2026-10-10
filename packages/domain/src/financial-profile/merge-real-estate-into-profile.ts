import type { ProfileAsset, ProfileLiability } from "@moat/contracts";
import type { RealEstateInvestment } from "@moat/data-access";

export type LinkedPlaidAccountForMortgage = {
	id: string;
	name: string;
	officialName: string | null;
	currentBalance: number | null;
};

export type RealEstateForProfileMerge = Pick<
	RealEstateInvestment,
	| "id"
	| "name"
	| "currentEstimatedValue"
	| "currentLoanBalance"
	| "interestRate"
	| "remainingTermMonths"
	| "monthlyMortgagePayment"
	| "linkedPlaidAccountId"
> & {
	linkedPlaidAccount?: LinkedPlaidAccountForMortgage | null;
};

export function realEstateAssetId(id: string) {
	return `real-estate-${id}`;
}

export function mortgageLiabilityId(id: string) {
	return `mortgage-${id}`;
}

function mortgageLiabilityName(property: RealEstateForProfileMerge) {
	return (
		property.linkedPlaidAccount?.name ??
		property.linkedPlaidAccount?.officialName ??
		`${property.name} mortgage`
	);
}

function mortgageBalance(property: RealEstateForProfileMerge) {
	return Math.abs(
		property.linkedPlaidAccount?.currentBalance ?? property.currentLoanBalance,
	);
}

function formatPayoffDate(remainingTermMonths: number | null) {
	if (!remainingTermMonths || remainingTermMonths <= 0) return undefined;
	const date = new Date();
	date.setMonth(date.getMonth() + remainingTermMonths);
	return date.toISOString().slice(0, 10);
}

export function mergeRealEstateAssets(
	storedAssets: ProfileAsset[],
	realEstate: RealEstateForProfileMerge[],
): ProfileAsset[] {
	const generatedIds = new Set(
		realEstate.map((property) => realEstateAssetId(property.id)),
	);
	const storedById = new Map(storedAssets.map((asset) => [asset.id, asset]));
	const manualAssets = storedAssets.filter(
		(asset) => !generatedIds.has(asset.id),
	);
	const syncedAssets = realEstate.map<ProfileAsset>((property) => {
		const id = realEstateAssetId(property.id);
		const storedAsset = storedById.get(id);
		return {
			id,
			name: property.name,
			type: "Real estate",
			estimatedValue: property.currentEstimatedValue,
			linkedLiability:
				storedAsset?.linkedLiability ?? mortgageLiabilityName(property),
			linkedInsurance: storedAsset?.linkedInsurance,
			includeInNetWorth: storedAsset?.includeInNetWorth ?? true,
			includeInForecast: storedAsset?.includeInForecast ?? true,
		};
	});

	return [...manualAssets, ...syncedAssets];
}

export function mergeMortgageLiabilities(
	storedLiabilities: ProfileLiability[],
	realEstate: RealEstateForProfileMerge[],
): ProfileLiability[] {
	const mortgageProperties = realEstate.filter(
		(property) =>
			property.currentLoanBalance > 0 ||
			property.linkedPlaidAccount != null ||
			property.linkedPlaidAccountId != null,
	);
	const generatedIds = new Set(
		mortgageProperties.map((property) => mortgageLiabilityId(property.id)),
	);
	const storedById = new Map(
		storedLiabilities.map((liability) => [liability.id, liability]),
	);
	const manualLiabilities = storedLiabilities.filter(
		(liability) => !generatedIds.has(liability.id),
	);
	const syncedLiabilities = mortgageProperties.map<ProfileLiability>(
		(property) => {
			const id = mortgageLiabilityId(property.id);
			const storedLiability = storedById.get(id);
			return {
				id,
				name: mortgageLiabilityName(property),
				type: "Mortgage",
				balance: mortgageBalance(property),
				interestRate:
					property.interestRate !== null ? property.interestRate * 100 : 0,
				monthlyPayment: property.monthlyMortgagePayment ?? 0,
				linkedAsset: property.name,
				payoffDate:
					storedLiability?.payoffDate ??
					formatPayoffDate(property.remainingTermMonths),
				includeInNetWorth: storedLiability?.includeInNetWorth ?? false,
				includeInForecast: storedLiability?.includeInForecast ?? true,
			};
		},
	);

	return [...manualLiabilities, ...syncedLiabilities];
}
