import type {
	ListAssetsInput,
	ListRealEstateInput,
	ProfileOtherAssetType,
} from "@moat/mcp-contracts";
import {
	mcpToolContracts,
	profileOtherAssetTypeSchema,
} from "@moat/mcp-contracts";
import { differenceInYears } from "date-fns";
import { z } from "zod";
import type { McpAuthContext } from "~/auth/types";
import { getAccountSyncCoverage } from "./coverage";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

const profileAssetSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	estimatedValue: z.number(),
	linkedLiability: z.string().optional(),
	linkedInsurance: z.string().optional(),
	includeInNetWorth: z.boolean(),
	includeInForecast: z.boolean(),
});

const profileLiabilitySchema = z.object({
	id: z.string(),
	name: z.string(),
	balance: z.number(),
});

export type ProfileOtherAsset = z.infer<typeof profileAssetSchema>;

export function parseProfileAssets(value: unknown): ProfileOtherAsset[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((asset) => {
		const parsed = profileAssetSchema.safeParse(asset);
		return parsed.success ? [parsed.data] : [];
	});
}

export function parseProfileLiabilities(
	value: unknown,
): Array<z.infer<typeof profileLiabilitySchema>> {
	if (!Array.isArray(value)) return [];
	return value.flatMap((liability) => {
		const parsed = profileLiabilitySchema.safeParse(liability);
		return parsed.success ? [parsed.data] : [];
	});
}

export function isNonRealEstateProfileAsset(
	asset: ProfileOtherAsset,
): asset is ProfileOtherAsset & { type: ProfileOtherAssetType } {
	return profileOtherAssetTypeSchema.safeParse(asset.type).success;
}

export function yearsOwnedFromPurchaseDate(
	purchaseDate: Date | null | undefined,
	asOf: Date = new Date(),
): number | null {
	if (!purchaseDate) return null;
	const years = differenceInYears(asOf, purchaseDate);
	return years < 0 ? null : years;
}

export function loadNetWorthOtherAssets(profileAssetsJson: unknown): Array<{
	id: string;
	name: string;
	type: string;
	estimatedValue: number;
}> {
	return parseProfileAssets(profileAssetsJson)
		.filter(
			(asset) =>
				asset.includeInNetWorth &&
				asset.type !== "Real estate" &&
				!asset.id.startsWith("real-estate-"),
		)
		.map((asset) => ({
			id: asset.id,
			name: asset.name,
			type: asset.type,
			estimatedValue: asset.estimatedValue,
		}));
}

export const listRealEstateTool: McpToolImplementation<ListRealEstateInput> = {
	contract: mcpToolContracts["moat.listRealEstate"],
	async execute(_input, context) {
		const [properties, coverage] = await Promise.all([
			context.db.realEstateInvestment.findMany({
				where: { userId: context.userId },
				select: {
					id: true,
					name: true,
					propertyType: true,
					usageType: true,
					currentEstimatedValue: true,
					currentLoanBalance: true,
					purchasePrice: true,
					purchaseDate: true,
					interestRate: true,
					monthlyMortgagePayment: true,
					remainingTermMonths: true,
					monthlyRent: true,
					totalMonthlyExpenses: true,
				},
				orderBy: { name: "asc" },
			}),
			getAccountSyncCoverage(context),
		]);

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
				purchasePrice: property.purchasePrice,
				purchaseDate: property.purchaseDate
					? property.purchaseDate.toISOString().slice(0, 10)
					: null,
				yearsOwned: yearsOwnedFromPurchaseDate(property.purchaseDate, asOfDate),
				interestRate: property.interestRate,
				monthlyMortgagePayment: property.monthlyMortgagePayment,
				remainingTermMonths: property.remainingTermMonths,
				monthlyRent: property.monthlyRent,
				totalMonthlyExpenses: property.totalMonthlyExpenses,
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

		return schemaEnvelope("finance.real_estate", {
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

export const listAssetsTool: McpToolImplementation<ListAssetsInput> = {
	contract: mcpToolContracts["moat.listAssets"],
	async execute(input, context) {
		const [profile, coverage] = await Promise.all([
			context.db.financialProfileData.findUnique({
				where: { userId: context.userId },
				select: { assets: true, liabilities: true },
			}),
			getAccountSyncCoverage(context),
		]);

		const liabilities = parseProfileLiabilities(profile?.liabilities);
		const liabilityByName = new Map(
			liabilities.map((liability) => [liability.name, liability]),
		);
		const typeFilter =
			input.types && input.types.length > 0 ? new Set(input.types) : null;

		const assets = parseProfileAssets(profile?.assets)
			.filter(isNonRealEstateProfileAsset)
			.filter((asset) => !asset.id.startsWith("real-estate-"))
			.filter((asset) =>
				input.includeNetWorthOnly ? asset.includeInNetWorth : true,
			)
			.filter((asset) => (typeFilter ? typeFilter.has(asset.type) : true))
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

		return schemaEnvelope("finance.assets", {
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

export async function getProfileOtherAssetsForNetWorth(
	context: McpAuthContext,
) {
	const profile = await context.db.financialProfileData.findUnique({
		where: { userId: context.userId },
		select: { assets: true },
	});
	return loadNetWorthOtherAssets(profile?.assets);
}
