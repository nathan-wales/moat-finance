import {
	getInsurancePolicyDisplayName,
	getInsurancePolicyTypeLabel,
} from "@moat/contracts";
import { type FieldValues, stringValue } from "./components";
import type { Asset, InsurancePolicy, Liability } from "./types";

const AUTO_TERMS = ["auto", "car", "truck", "suv", "van", "vehicle"];
const BOAT_TERMS = ["boat", "marine", "watercraft"];
const HOME_TERMS = ["home", "house", "mortgage", "property", "real estate"];

export function getAssetFieldsWithLinkOptions(params: {
	liabilities: Liability[];
	insurancePolicies: InsurancePolicy[];
}) {
	return {
		linkedLiabilityOptions: (values: FieldValues) =>
			filterLiabilitiesForAssetType(
				params.liabilities,
				stringValue(values.type),
			).map((liability) => liability.name),
		linkedInsuranceOptions: (values: FieldValues) =>
			filterPoliciesForAssetType(
				params.insurancePolicies,
				stringValue(values.type),
			).map(getInsurancePolicyDisplayName),
	};
}

export function getLiabilityLinkedAssetOptions(params: {
	assets: Asset[];
	liabilityType: string;
}) {
	return filterAssetsForLiabilityType(params.assets, params.liabilityType).map(
		(asset) => asset.name,
	);
}

export function getPolicyLinkedAssetOptions(params: {
	assets: Asset[];
	insuranceType: string;
}) {
	return filterAssetsForInsuranceType(params.assets, params.insuranceType).map(
		(asset) => asset.name,
	);
}

function filterLiabilitiesForAssetType(
	liabilities: Liability[],
	assetType: string,
) {
	return liabilities.filter((liability) =>
		matchesAssetDomain(
			assetType,
			searchableText(liability.name, liability.type),
		),
	);
}

function filterPoliciesForAssetType(
	policies: InsurancePolicy[],
	assetType: string,
) {
	return policies.filter((policy) =>
		matchesAssetDomain(
			assetType,
			searchableText(
				getInsurancePolicyDisplayName(policy),
				getInsurancePolicyTypeLabel(policy),
			),
		),
	);
}

function filterAssetsForLiabilityType(assets: Asset[], liabilityType: string) {
	return assets.filter((asset) =>
		matchesAssetDomain(asset.type, searchableText(liabilityType)),
	);
}

function filterAssetsForInsuranceType(assets: Asset[], insuranceType: string) {
	return assets.filter((asset) =>
		matchesAssetDomain(asset.type, searchableText(insuranceType, asset.name)),
	);
}

function matchesAssetDomain(assetType: string, candidateText: string) {
	if (assetType === "Real estate")
		return containsAny(candidateText, HOME_TERMS);
	if (assetType === "Boat") return containsAny(candidateText, BOAT_TERMS);
	if (assetType === "Vehicle") {
		return (
			containsAny(candidateText, AUTO_TERMS) &&
			!containsAny(candidateText, BOAT_TERMS)
		);
	}
	if (assetType === "Business") return candidateText.includes("business");
	if (assetType === "Personal property") {
		return (
			candidateText.includes("personal") || candidateText.includes("property")
		);
	}
	return false;
}

function containsAny(value: string, terms: string[]) {
	return terms.some((term) => value.includes(term));
}

function searchableText(...parts: Array<string | undefined>) {
	return parts.filter(Boolean).join(" ").toLowerCase();
}
