import { formatAccountTypeLabel, formatBalanceSyncLabel } from "@moat/domain";
import { z } from "zod";
import type {
	InvestmentType,
	PrismaClient,
} from "../../../../generated/prisma";

export type PortfolioAllocationItem = {
	id: string;
	name: string;
	value: number;
	subtitle?: string;
	lastSynced?: string;
};

export type PortfolioAllocationSection = {
	key: string;
	label: string;
	value: number;
	items: PortfolioAllocationItem[];
};

const financialProfileAssetSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	estimatedValue: z.number(),
	includeInNetWorth: z.boolean(),
});

function mapPlaidSubtypeToInvestmentType(
	subtype: string | null,
): InvestmentType {
	if (!subtype) return "STOCKS";
	const sub = subtype.toLowerCase();
	if (sub.includes("401")) return "FOUR01K";
	if (sub.includes("roth")) return "ROTH_IRA";
	if (sub.includes("ira") && !sub.includes("roth")) return "ROTH_IRA";
	if (sub.includes("brokerage")) return "STOCKS";
	if (sub.includes("hsa")) return "HSA";
	return "STOCKS";
}

function parseFinancialProfileAssets(value: unknown) {
	const result = z.array(financialProfileAssetSchema).safeParse(value);
	if (!result.success) return [];
	return result.data.filter(
		(asset) => asset.includeInNetWorth && asset.type !== "Real estate",
	);
}

export async function buildPortfolioAllocationSections(
	db: PrismaClient,
	userId: string,
	options?: {
		itemSubtitlePrefix?: string;
		idPrefix?: string;
	},
): Promise<PortfolioAllocationSection[]> {
	const [
		manualInvestments,
		plaidInvestmentAccounts,
		realEstate,
		plaidDepositoryAccounts,
		financialProfileData,
	] = await Promise.all([
		db.investment.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
		}),
		db.plaidAccount.findMany({
			where: {
				userId,
				type: "investment",
				isActive: true,
				investmentHidden: false,
			},
			include: {
				plaidItem: { select: { lastBalanceSyncAt: true } },
			},
		}),
		db.realEstateInvestment.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
		}),
		db.plaidAccount.findMany({
			where: { userId, type: "depository", isActive: true },
			select: {
				id: true,
				name: true,
				subtype: true,
				currentBalance: true,
				availableBalance: true,
				lastBalanceSyncAt: true,
				plaidItem: { select: { lastBalanceSyncAt: true } },
			},
		}),
		db.financialProfileData.findUnique({
			where: { userId },
			select: { assets: true },
		}),
	]);

	const investments = [
		...manualInvestments,
		...plaidInvestmentAccounts.map((acc) => ({
			id: `plaid_${acc.id}`,
			userId: acc.userId,
			type: mapPlaidSubtypeToInvestmentType(acc.subtype),
			name: acc.name,
			startingBalance: acc.currentBalance ?? 0,
			monthlyContribution: acc.monthlyContribution,
			annualReturnRate: acc.annualReturnRate,
			notes: acc.notes ?? null,
			createdAt: acc.createdAt,
			updatedAt: acc.updatedAt,
			subtitle: formatAccountTypeLabel(acc.subtype),
			lastSynced: formatBalanceSyncLabel(
				acc.lastBalanceSyncAt ?? acc.plaidItem?.lastBalanceSyncAt,
			),
		})),
	];
	const financialProfileAssets = parseFinancialProfileAssets(
		financialProfileData?.assets,
	);

	const prefixId = (id: string) =>
		options?.idPrefix ? `${options.idPrefix}:${id}` : id;
	const withSubtitle = (
		item: PortfolioAllocationItem,
	): PortfolioAllocationItem => {
		if (!options?.itemSubtitlePrefix) return item;
		const existing = item.subtitle?.trim();
		return {
			...item,
			subtitle: existing
				? `${options.itemSubtitlePrefix} · ${existing}`
				: options.itemSubtitlePrefix,
		};
	};

	const byType = (type: string) =>
		investments.filter((investment) => investment.type === type);
	const toItems = (
		invs: Array<{
			id: string;
			name: string;
			startingBalance: number;
			lastSynced?: string;
			subtitle?: string;
		}>,
	) =>
		invs.map((investment) =>
			withSubtitle({
				id: prefixId(investment.id),
				name: investment.name,
				value: investment.startingBalance,
				...(investment.subtitle ? { subtitle: investment.subtitle } : {}),
				...(investment.lastSynced ? { lastSynced: investment.lastSynced } : {}),
			}),
		);

	const sections = [
		{
			key: "stocks",
			label: "Stocks",
			value: byType("STOCKS").reduce((s, i) => s + i.startingBalance, 0),
			items: toItems(byType("STOCKS")),
		},
		{
			key: "rothIra",
			label: "Roth IRA",
			value: byType("ROTH_IRA").reduce((s, i) => s + i.startingBalance, 0),
			items: toItems(byType("ROTH_IRA")),
		},
		{
			key: "401k",
			label: "401(k)",
			value: byType("FOUR01K").reduce((s, i) => s + i.startingBalance, 0),
			items: toItems(byType("FOUR01K")),
		},
		{
			key: "hsa",
			label: "HSA",
			value: byType("HSA").reduce((s, i) => s + i.startingBalance, 0),
			items: toItems(byType("HSA")),
		},
		{
			key: "other",
			label: "Other",
			value: byType("OTHER").reduce((s, i) => s + i.startingBalance, 0),
			items: toItems(byType("OTHER")),
		},
		{
			key: "cash",
			label: "Cash",
			value: plaidDepositoryAccounts.reduce(
				(s, a) => s + (a.currentBalance ?? a.availableBalance ?? 0),
				0,
			),
			items: plaidDepositoryAccounts.map((a) =>
				withSubtitle({
					id: prefixId(a.id),
					name: a.name,
					value: a.currentBalance ?? a.availableBalance ?? 0,
					subtitle: formatAccountTypeLabel(a.subtype),
					lastSynced: formatBalanceSyncLabel(
						a.lastBalanceSyncAt ?? a.plaidItem.lastBalanceSyncAt,
					),
				}),
			),
		},
		{
			key: "realEstate",
			label: "Real Estate",
			value: realEstate.reduce(
				(s, p) => s + (p.currentEstimatedValue - p.currentLoanBalance),
				0,
			),
			items: realEstate.map((p) =>
				withSubtitle({
					id: prefixId(p.id),
					name: p.name,
					value: p.currentEstimatedValue - p.currentLoanBalance,
					subtitle: `Loan balance: $${p.currentLoanBalance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
				}),
			),
		},
		{
			key: "otherAssets",
			label: "Other Assets",
			value: financialProfileAssets.reduce(
				(sum, asset) => sum + asset.estimatedValue,
				0,
			),
			items: financialProfileAssets.map((asset) =>
				withSubtitle({
					id: prefixId(asset.id),
					name: asset.name,
					value: asset.estimatedValue,
					subtitle: asset.type,
				}),
			),
		},
	]
		.filter((section) => section.value > 0)
		.sort((a, b) => b.value - a.value);

	return sections;
}

export function mergePortfolioAllocationSections(
	baseSections: PortfolioAllocationSection[],
	childSections: PortfolioAllocationSection[],
): PortfolioAllocationSection[] {
	const byKey = new Map<string, PortfolioAllocationSection>();

	for (const section of [...baseSections, ...childSections]) {
		const existing = byKey.get(section.key);
		if (!existing) {
			byKey.set(section.key, {
				...section,
				items: [...section.items],
			});
			continue;
		}
		existing.value += section.value;
		existing.items.push(...section.items);
	}

	return Array.from(byKey.values())
		.filter((section) => section.value > 0)
		.sort((a, b) => b.value - a.value);
}
