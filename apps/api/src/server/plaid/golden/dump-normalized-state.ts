import {
	assembleNormalizedState,
	money,
	type NormalizedAccount,
	type NormalizedFinancialState,
	type NormalizedTransaction,
	transferPairKey,
	utcDateString,
} from "@moat/plaid-golden-ledger";
import { db } from "~/server/db";
import { withGoldenActor } from "./with-golden-actor";

function asNumber(value: unknown): number {
	if (typeof value === "number") return money(value);
	if (typeof value === "string") return money(Number(value));
	if (value && typeof value === "object" && "toFixed" in value) {
		return money(
			Number((value as { toFixed: (digits: number) => string }).toFixed(2)),
		);
	}
	return 0;
}

export async function dumpPostgresNormalizedState(
	userId: string,
): Promise<NormalizedFinancialState> {
	if (process.env.NODE_ENV !== "test" && process.env.MOAT_E2E !== "1") {
		throw new Error("dumpPostgresNormalizedState is test-only");
	}

	return withGoldenActor(async () => {
		const accounts = await db.plaidAccount.findMany({
			where: { userId },
			select: {
				plaidAccountId: true,
				name: true,
				mask: true,
				type: true,
				subtype: true,
				syncEnabled: true,
				accountHidden: true,
				currentBalance: true,
				availableBalance: true,
			},
		});
		const transactions = await db.transaction.findMany({
			where: { userId },
			select: {
				externalTransactionId: true,
				amount: true,
				date: true,
				postedDate: true,
				type: true,
				pending: true,
				hidden: true,
				autoHiddenAsTransfer: true,
				removedAt: true,
				transferPairId: true,
				description: true,
				categoryRef: { select: { name: true } },
				plaidAccount: { select: { plaidAccountId: true } },
				hashtags: { select: { hashtag: { select: { name: true } } } },
			},
		});

		const pairMembers = new Map<string, string[]>();
		for (const row of transactions) {
			if (!row.transferPairId || !row.externalTransactionId) continue;
			const members = pairMembers.get(row.transferPairId) ?? [];
			members.push(row.externalTransactionId);
			pairMembers.set(row.transferPairId, members);
		}

		const normalizedAccounts: NormalizedAccount[] = accounts.map((account) => ({
			providerAccountId: account.plaidAccountId,
			name: account.name,
			mask: account.mask,
			type: account.type,
			subtype: account.subtype,
			syncEnabled: account.syncEnabled,
			hidden: account.accountHidden,
			currentBalance:
				account.currentBalance === null ? null : money(account.currentBalance),
			availableBalance:
				account.availableBalance === null
					? null
					: money(account.availableBalance),
		}));

		const normalizedTransactions: NormalizedTransaction[] = transactions.map(
			(row) => {
				const providerTransactionId = row.externalTransactionId ?? "";
				const pairIds = row.transferPairId
					? (pairMembers.get(row.transferPairId) ?? [])
					: [];
				const partner = pairIds.find((id) => id !== providerTransactionId);
				return {
					providerTransactionId,
					providerAccountId: row.plaidAccount?.plaidAccountId ?? null,
					amount: asNumber(row.amount),
					date: utcDateString(row.postedDate ?? row.date),
					category: row.categoryRef?.name ?? "Uncategorized",
					description: row.description ?? "",
					type: row.type === "INCOME" ? "INCOME" : "EXPENSE",
					pending: row.pending,
					hidden: row.hidden,
					autoHiddenAsTransfer: row.autoHiddenAsTransfer,
					removed: row.removedAt !== null,
					transferPairKey:
						providerTransactionId && partner
							? transferPairKey(providerTransactionId, partner)
							: null,
					hashtags: row.hashtags.map((entry) => entry.hashtag.name),
				};
			},
		);

		return assembleNormalizedState({
			accounts: normalizedAccounts,
			transactions: normalizedTransactions,
		});
	});
}
