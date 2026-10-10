import type { ProfileOtherAssetType } from "@moat/mcp-contracts";
import {
	listAssetsInputSchema,
	mcpToolContracts,
	profileOtherAssetTypeSchema,
} from "@moat/mcp-contracts";
import { differenceInYears } from "date-fns";
import { localCoverage } from "./format";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

function isOtherAssetType(type: string): type is ProfileOtherAssetType {
	return profileOtherAssetTypeSchema.safeParse(type).success;
}

function yearsOwnedFromPurchaseDate(
	purchaseDate: Date | string | null | undefined,
	asOf: Date = new Date(),
): number | null {
	if (!purchaseDate) return null;
	const date =
		purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate);
	if (Number.isNaN(date.getTime())) return null;
	const years = differenceInYears(asOf, date);
	return years < 0 ? null : years;
}

function toDateString(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString().slice(0, 10);
}

export const listRealEstateTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listRealEstate"],
	async execute(_input, ctx: LocalToolContext) {
		const { userId, repositories } = ctx.appRuntime;
		const accounts = await repositories.accounts.listForSummary({ userId });
		const activeCount = accounts.filter(
			(account) => !account.isHidden && account.isActive,
		).length;
		const coverage = localCoverage(activeCount);
		const properties = (await repositories.realEstate?.list({ userId })) ?? [];
		const asOfDate = new Date(coverage.asOf);

		const mapped = properties.map((property) => {
			const equity =
				property.currentEstimatedValue - property.currentLoanBalance;
			return {
				id: property.id,
				name: property.name,
				propertyType: property.propertyType,
				usageType: property.usageType,
				currentEstimatedValue: property.currentEstimatedValue,
				currentLoanBalance: property.currentLoanBalance,
				equity,
				purchasePrice: property.purchasePrice ?? null,
				purchaseDate: toDateString(property.purchaseDate),
				yearsOwned: yearsOwnedFromPurchaseDate(property.purchaseDate, asOfDate),
				interestRate: property.interestRate ?? null,
				monthlyMortgagePayment: property.monthlyMortgagePayment ?? null,
				remainingTermMonths: property.remainingTermMonths ?? null,
				monthlyRent: property.monthlyRent ?? null,
				totalMonthlyExpenses: property.totalMonthlyExpenses ?? null,
			};
		});

		const estimatedValue = mapped.reduce(
			(sum, property) => sum + property.currentEstimatedValue,
			0,
		);
		const loanBalance = mapped.reduce(
			(sum, property) => sum + property.currentLoanBalance,
			0,
		);

		return localSchemaEnvelope("finance.real_estate", {
			asOf: coverage.asOf,
			properties: mapped,
			totals: {
				count: mapped.length,
				estimatedValue,
				loanBalance,
				equity: estimatedValue - loanBalance,
			},
			coverage,
			definitive: coverage.isComplete,
		});
	},
};

export const listAssetsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listAssets"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = listAssetsInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		const accounts = await repositories.accounts.listForSummary({ userId });
		const activeCount = accounts.filter(
			(account) => !account.isHidden && account.isActive,
		).length;
		const coverage = localCoverage(activeCount);
		const profile =
			(await repositories.financialProfileData?.get({ userId })) ?? null;

		const liabilities = profile?.liabilities ?? [];
		const liabilityByName = new Map(
			liabilities.map((liability) => [liability.name, liability]),
		);
		const typeFilter =
			parsed.types && parsed.types.length > 0 ? new Set(parsed.types) : null;

		const assets = (profile?.assets ?? [])
			.filter(
				(asset) =>
					isOtherAssetType(asset.type) && !asset.id.startsWith("real-estate-"),
			)
			.filter((asset) =>
				parsed.includeNetWorthOnly ? asset.includeInNetWorth : true,
			)
			.filter((asset) =>
				typeFilter && isOtherAssetType(asset.type)
					? typeFilter.has(asset.type)
					: true,
			)
			.map((asset) => {
				const linked =
					asset.linkedLiability != null
						? (liabilityByName.get(asset.linkedLiability) ?? null)
						: null;
				const loanBalance = linked?.balance ?? null;
				const equity =
					loanBalance == null ? null : asset.estimatedValue - loanBalance;
				return {
					id: asset.id,
					name: asset.name,
					type: asset.type,
					estimatedValue: asset.estimatedValue,
					loanBalance,
					equity,
					linkedLiability: asset.linkedLiability ?? null,
					linkedInsurance: asset.linkedInsurance ?? null,
					includeInNetWorth: asset.includeInNetWorth,
					includeInForecast: asset.includeInForecast,
				};
			});

		const estimatedValue = assets.reduce(
			(sum, asset) => sum + asset.estimatedValue,
			0,
		);
		const loanBalance = assets.reduce(
			(sum, asset) => sum + (asset.loanBalance ?? 0),
			0,
		);

		return localSchemaEnvelope("finance.assets", {
			asOf: coverage.asOf,
			assets,
			totals: {
				count: assets.length,
				estimatedValue,
				loanBalance,
				equity: estimatedValue - loanBalance,
			},
			coverage,
			definitive: false,
		});
	},
};
