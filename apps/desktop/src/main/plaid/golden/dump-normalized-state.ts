import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	assembleNormalizedState,
	money,
	type NormalizedAccount,
	type NormalizedFinancialState,
	type NormalizedTransaction,
	transferPairKey,
	utcDateString,
} from "@moat/plaid-golden-ledger";

export async function dumpSqliteNormalizedState(
	db: SqliteDbClient,
	userId: string,
): Promise<NormalizedFinancialState> {
	if (process.env.NODE_ENV !== "test" && process.env.MOAT_E2E !== "1") {
		throw new Error("dumpSqliteNormalizedState is test-only");
	}

	const [accounts, transactions] = await Promise.all([
		db.plaidAccount.findMany({
			where: { item: { userId } },
			select: {
				plaidAccountId: true,
				name: true,
				mask: true,
				type: true,
				subtype: true,
				syncEnabled: true,
				isHidden: true,
				currentBalance: true,
				availableBalance: true,
			},
		}),
		db.transaction.findMany({
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
				category: { select: { name: true } },
				plaidAccount: { select: { plaidAccountId: true } },
				hashtags: { select: { hashtag: { select: { name: true } } } },
			},
		}),
	]);

	const pairMembers = new Map<string, string[]>();
	for (const row of transactions as Array<{
		transferPairId: string | null;
		externalTransactionId: string | null;
	}>) {
		if (!row.transferPairId || !row.externalTransactionId) continue;
		const members = pairMembers.get(row.transferPairId) ?? [];
		members.push(row.externalTransactionId);
		pairMembers.set(row.transferPairId, members);
	}

	const normalizedAccounts: NormalizedAccount[] = (
		accounts as Array<{
			plaidAccountId: string;
			name: string;
			mask: string | null;
			type: string;
			subtype: string | null;
			syncEnabled: boolean | number;
			isHidden: boolean | number;
			currentBalance: number | null;
			availableBalance: number | null;
		}>
	).map((account) => ({
		providerAccountId: account.plaidAccountId,
		name: account.name,
		mask: account.mask,
		type: account.type,
		subtype: account.subtype,
		syncEnabled: Boolean(account.syncEnabled),
		hidden: Boolean(account.isHidden),
		currentBalance:
			account.currentBalance === null ? null : money(account.currentBalance),
		availableBalance:
			account.availableBalance === null
				? null
				: money(account.availableBalance),
	}));

	const normalizedTransactions: NormalizedTransaction[] = (
		transactions as Array<{
			externalTransactionId: string | null;
			amount: number;
			date: Date | string;
			postedDate: Date | string | null;
			type: string;
			pending: boolean | number;
			hidden: boolean | number;
			autoHiddenAsTransfer: boolean | number;
			removedAt: Date | string | null;
			transferPairId: string | null;
			description: string | null;
			category: { name: string } | null;
			plaidAccount: { plaidAccountId: string } | null;
			hashtags: Array<{ hashtag: { name: string } }>;
		}>
	).map((row) => {
		const providerTransactionId = row.externalTransactionId ?? "";
		const pairIds = row.transferPairId
			? (pairMembers.get(row.transferPairId) ?? [])
			: [];
		const partner = pairIds.find((id) => id !== providerTransactionId);
		return {
			providerTransactionId,
			providerAccountId: row.plaidAccount?.plaidAccountId ?? null,
			amount: money(row.amount),
			date: utcDateString(row.postedDate ?? row.date),
			category: row.category?.name ?? "Uncategorized",
			description: row.description ?? "",
			type: row.type === "INCOME" ? "INCOME" : "EXPENSE",
			pending: Boolean(row.pending),
			hidden: Boolean(row.hidden),
			autoHiddenAsTransfer: Boolean(row.autoHiddenAsTransfer),
			removed: row.removedAt !== null,
			transferPairKey:
				providerTransactionId && partner
					? transferPairKey(providerTransactionId, partner)
					: null,
			hashtags: row.hashtags.map((entry) => entry.hashtag.name),
		};
	});

	return assembleNormalizedState({
		accounts: normalizedAccounts,
		transactions: normalizedTransactions,
	});
}
