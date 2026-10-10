import { splitParentExclusionWhere } from "@moat/data-access";
import { subMonths } from "date-fns";
import type { PrismaClientLike } from "./types";

const CONTRIBUTION_LOOKBACK_MONTHS = 12;

export async function refreshPlaidInvestmentContributionInputs(params: {
	db: PrismaClientLike;
	userId: string;
	plaidAccountIds?: string[];
}): Promise<void> {
	const { db, userId, plaidAccountIds } = params;

	const accounts = await db.plaidAccount.findMany({
		where: {
			userId,
			type: "investment",
			isActive: true,
			forecastInputsUserEdited: false,
			...(plaidAccountIds ? { id: { in: plaidAccountIds } } : {}),
		},
		select: { id: true },
	});

	if (accounts.length === 0) return;

	const accountIds = accounts.map((account) => account.id);
	const since = subMonths(new Date(), CONTRIBUTION_LOOKBACK_MONTHS);

	const contributionRows = await db.transaction.groupBy({
		by: ["plaidAccountId"],
		where: {
			userId,
			source: "PLAID",
			type: "INCOME",
			pending: false,
			removedAt: null,
			plaidAccountId: { in: accountIds },
			date: { gte: since },
			AND: [splitParentExclusionWhere()],
			OR: [
				{ categoryRef: { is: null } },
				{
					categoryRef: {
						name: { notIn: ["Investments", "Transfer"] },
					},
				},
			],
		},
		_sum: { amount: true },
	});

	const monthlyContributionByAccountId = new Map(
		contributionRows.flatMap((row) => {
			if (!row.plaidAccountId) return [];
			return [
				[
					row.plaidAccountId,
					Number(row._sum.amount ?? 0) / CONTRIBUTION_LOOKBACK_MONTHS,
				],
			];
		}),
	);

	await Promise.all(
		accounts.map((account) =>
			db.plaidAccount.update({
				where: { id: account.id },
				data: {
					monthlyContribution:
						monthlyContributionByAccountId.get(account.id) ?? 0,
				},
			}),
		),
	);
}
