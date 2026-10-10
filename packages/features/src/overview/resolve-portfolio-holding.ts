import type { RealEstateInvestment } from "@moat/contracts";
import { barePlaidAccountId } from "../financial-profile/map-profile-type-to-investment-type";
import {
	isSyncedRealEstateAsset,
	realEstatePropertyIdFromAssetId,
} from "../financial-profile/real-estate/real-estate-asset-utils";
import type {
	Account,
	Asset,
	FinancialProfileData,
	Investment,
} from "../financial-profile/types";

export type PortfolioHoldingSectionKey =
	| "stocks"
	| "rothIra"
	| "401k"
	| "cash"
	| "hsa"
	| "realEstate"
	| "otherAssets"
	| "other";

export type ResolvedPortfolioHolding =
	| { kind: "account"; account: Account }
	| { kind: "realEstate"; property: RealEstateInvestment }
	| { kind: "asset"; asset: Asset };

function sourceIds(itemId: string): string[] {
	const colon = itemId.indexOf(":");
	if (colon <= 0) return [itemId];
	return [itemId, itemId.slice(colon + 1)];
}

function accountIdCandidates(itemId: string): string[] {
	const ids: string[] = [];
	for (const sourceId of sourceIds(itemId)) {
		const bare = barePlaidAccountId(sourceId);
		ids.push(
			sourceId,
			bare,
			`plaid-${bare}`,
			`plaid_${bare}`,
			`investment-acct-${sourceId}`,
			`investment-acct-${bare}`,
		);
	}
	return [...new Set(ids)];
}

function findAccountForItem(
	itemId: string,
	accounts: Account[],
	investments: Investment[],
): Account | null {
	const candidates = new Set(accountIdCandidates(itemId));
	const byAccountId = accounts.find((account) => candidates.has(account.id));
	if (byAccountId) return byAccountId;

	const linkedInvestment = investments.find(
		(investment) =>
			candidates.has(investment.id) ||
			(investment.accountLink !== undefined &&
				candidates.has(investment.accountLink)),
	);
	if (!linkedInvestment) return null;
	if (linkedInvestment.accountLink) {
		const linkedAccount = accounts.find(
			(account) => account.id === linkedInvestment.accountLink,
		);
		if (linkedAccount) return linkedAccount;
	}
	return (
		accounts.find(
			(account) => account.id === `investment-acct-${linkedInvestment.id}`,
		) ?? null
	);
}

function findRealEstateProperty(
	itemId: string,
	properties: RealEstateInvestment[],
): RealEstateInvestment | null {
	for (const sourceId of sourceIds(itemId)) {
		const propertyId = isSyncedRealEstateAsset(sourceId)
			? realEstatePropertyIdFromAssetId(sourceId)
			: sourceId;
		const property = properties.find((item) => item.id === propertyId);
		if (property) return property;
	}
	return null;
}

function findOtherAsset(itemId: string, assets: Asset[]): Asset | null {
	const candidates = new Set(sourceIds(itemId));
	return assets.find((asset) => candidates.has(asset.id)) ?? null;
}

export function resolvePortfolioHolding(
	itemId: string,
	sectionKey: PortfolioHoldingSectionKey,
	profile: FinancialProfileData,
	realEstateProperties: RealEstateInvestment[],
): ResolvedPortfolioHolding | null {
	if (sectionKey === "realEstate") {
		const property = findRealEstateProperty(itemId, realEstateProperties);
		if (property) return { kind: "realEstate", property };
		const realEstateAsset = findOtherAsset(itemId, profile.assets);
		if (realEstateAsset) return { kind: "asset", asset: realEstateAsset };
		return null;
	}

	if (sectionKey === "otherAssets") {
		const asset = findOtherAsset(itemId, profile.assets);
		return asset ? { kind: "asset", asset } : null;
	}

	const account = findAccountForItem(
		itemId,
		profile.accounts,
		profile.investments,
	);
	return account ? { kind: "account", account } : null;
}
