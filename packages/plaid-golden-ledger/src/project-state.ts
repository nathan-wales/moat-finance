import { mapPlaidCategory } from "@moat/category-mapping";
import {
	accountNetWorthContribution,
	matchTransferLegs,
	resolveAccountTypeKind,
	TRANSFER_MATCH_WINDOW_DAYS,
	type TransferMatchLeg,
} from "@moat/domain";
import { HIDDEN_SPENDING_CATEGORY_NAMES, money } from "./dump-contract";
import {
	buildGoldenLedger,
	GOLDEN_ACCOUNT_IDS,
	GOLDEN_COSTCO_RULE,
	USER_CATEGORY_OVERRIDES_AFTER_INITIAL,
} from "./ledger";
import { LEDGER_TODAY } from "./ledger-today";
import type { GoldenPlaidAccount, GoldenPlaidTransaction } from "./plaid-shape";
import { sortNormalizedState, transferPairKey } from "./sort";
import type {
	GoldenDumpPhase,
	NormalizedAccount,
	NormalizedFinancialState,
	NormalizedTransaction,
	UserCategoryOverride,
} from "./types";

const HIDDEN_CATEGORY_SET = new Set<string>(HIDDEN_SPENDING_CATEGORY_NAMES);

function applyCostcoRule(category: string, description: string): string {
	if (
		description
			.toLowerCase()
			.includes(GOLDEN_COSTCO_RULE.descriptionContains.toLowerCase())
	) {
		return GOLDEN_COSTCO_RULE.setCategory;
	}
	return category;
}

function seedCategory(tx: GoldenPlaidTransaction): string {
	const fromPlaid = mapPlaidCategory({
		personal_finance_category: tx.personal_finance_category,
	});
	return applyCostcoRule(fromPlaid, tx.name);
}

function moneyType(amount: number): "INCOME" | "EXPENSE" {
	return amount < 0 ? "INCOME" : "EXPENSE";
}

function accountTypeKind(
	accountId: string,
	accounts: GoldenPlaidAccount[],
): TransferMatchLeg["accountTypeKind"] {
	const account = accounts.find((row) => row.account_id === accountId);
	return resolveAccountTypeKind(account?.type, account?.subtype);
}

function toDraftTransaction(
	tx: GoldenPlaidTransaction,
	overrides: {
		pending?: boolean;
		amount?: number;
		category?: string;
		removed?: boolean;
	} = {},
): NormalizedTransaction {
	const amount = overrides.amount ?? tx.amount;
	return {
		providerTransactionId: tx.transaction_id,
		providerAccountId: tx.account_id,
		amount: money(Math.abs(amount)),
		date: tx.date,
		category: overrides.category ?? seedCategory({ ...tx, amount }),
		description: tx.name,
		type: moneyType(amount),
		pending: overrides.pending ?? tx.pending,
		hidden: false,
		autoHiddenAsTransfer: false,
		removed: overrides.removed ?? false,
		transferPairKey: null,
		hashtags: [],
	};
}

function applyUserOverrides(
	transactions: NormalizedTransaction[],
	overrides: UserCategoryOverride[],
): NormalizedTransaction[] {
	if (overrides.length === 0) return transactions;
	const byId = new Map(
		overrides.map((override) => [override.providerTransactionId, override]),
	);
	return transactions.map((tx) => {
		const override = byId.get(tx.providerTransactionId);
		if (!override) return tx;
		return { ...tx, category: override.category };
	});
}

function applyHistoricalMutations(
	transactions: NormalizedTransaction[],
	modified: GoldenPlaidTransaction[],
	removedIds: Set<string>,
	userOverrides: UserCategoryOverride[],
): NormalizedTransaction[] {
	const modifiedById = new Map(modified.map((tx) => [tx.transaction_id, tx]));
	const userById = new Map(
		userOverrides.map((override) => [override.providerTransactionId, override]),
	);
	return transactions.map((tx) => {
		const next = { ...tx, removed: removedIds.has(tx.providerTransactionId) };
		const patch = modifiedById.get(tx.providerTransactionId);
		if (!patch) return next;
		const userOverride = userById.get(tx.providerTransactionId);
		const remapped = seedCategory(patch);
		const category = userOverride
			? userOverride.category
			: tx.category === "Uncategorized"
				? remapped
				: tx.category;
		return {
			...next,
			amount: money(Math.abs(patch.amount)),
			type: moneyType(patch.amount),
			pending: patch.pending,
			date: patch.date,
			description: patch.name,
			category,
		};
	});
}

function pairTransactions(
	transactions: NormalizedTransaction[],
	accounts: GoldenPlaidAccount[],
): NormalizedTransaction[] {
	const pairable = transactions.filter(
		(tx) => !tx.pending && !tx.removed && tx.providerAccountId !== null,
	);
	const legs: TransferMatchLeg[] = pairable.map((tx) => ({
		id: tx.providerTransactionId,
		type: tx.type,
		amountKey: tx.amount.toFixed(2),
		currency: "USD",
		accountKey: tx.providerAccountId,
		timeMs: new Date(`${tx.date}T00:00:00Z`).getTime(),
		hidden: false,
		autoHiddenAsTransfer: false,
		categoryName: tx.category,
		accountTypeKind: accountTypeKind(tx.providerAccountId ?? "", accounts),
	}));
	const matches = matchTransferLegs(legs, TRANSFER_MATCH_WINDOW_DAYS);
	const pairById = new Map<string, string>();
	for (const match of matches) {
		const key = transferPairKey(match.expense.id, match.income.id);
		pairById.set(match.expense.id, key);
		pairById.set(match.income.id, key);
	}
	return transactions.map((tx) => {
		const key = pairById.get(tx.providerTransactionId);
		if (!key) return tx;
		return {
			...tx,
			hidden: true,
			autoHiddenAsTransfer: true,
			transferPairKey: key,
		};
	});
}

function toNormalizedAccount(
	account: GoldenPlaidAccount,
	syncEnabled: boolean,
): NormalizedAccount {
	return {
		providerAccountId: account.account_id,
		name: account.name,
		mask: account.mask,
		type: account.type,
		subtype: account.subtype,
		syncEnabled,
		hidden: false,
		currentBalance: money(account.balances.current),
		availableBalance: money(account.balances.available),
	};
}

export function aggregatesFor(
	accounts: NormalizedAccount[],
	transactions: NormalizedTransaction[],
): NormalizedFinancialState["aggregates"] {
	let spending = 0;
	let income = 0;
	let transfers = 0;
	for (const tx of transactions) {
		if (tx.removed) continue;
		if (tx.autoHiddenAsTransfer && tx.type === "EXPENSE") {
			transfers = money(transfers + tx.amount);
		}
		if (tx.hidden) continue;
		if (HIDDEN_CATEGORY_SET.has(tx.category)) continue;
		if (tx.type === "EXPENSE") spending = money(spending + tx.amount);
		if (tx.type === "INCOME") income = money(income + tx.amount);
	}
	const netWorth = money(
		accounts
			.filter((account) => account.syncEnabled && !account.hidden)
			.reduce(
				(sum, account) =>
					sum +
					accountNetWorthContribution({
						type: account.type,
						subtype: account.subtype,
						currentBalance: account.currentBalance,
					}),
				0,
			),
	);
	return { spending, income, transfers, netWorth };
}

export function projectNormalizedState(
	phase: GoldenDumpPhase,
	ledgerToday: string = LEDGER_TODAY,
	userOverrides: UserCategoryOverride[] = USER_CATEGORY_OVERRIDES_AFTER_INITIAL,
): NormalizedFinancialState {
	const ledger = buildGoldenLedger(ledgerToday);
	const initialRows = ledger.initialAdded.map((tx) => toDraftTransaction(tx));
	if (phase === "initial") {
		const transactions = pairTransactions(initialRows, ledger.accounts);
		const accounts = ledger.accounts.map((account) =>
			toNormalizedAccount(account, true),
		);
		return sortNormalizedState({
			accounts,
			transactions,
			aggregates: aggregatesFor(accounts, transactions),
		});
	}

	const afterOverrides = applyUserOverrides(initialRows, userOverrides);
	const removedIds = new Set(
		ledger.historicalRemoved.map((row) => row.transaction_id),
	);
	const mutated = applyHistoricalMutations(
		afterOverrides,
		ledger.historicalModified,
		removedIds,
		userOverrides,
	);
	const historicalAdded = ledger.historicalAdded
		.filter((tx) => tx.transaction_id !== ledger.disabledAccountSkippedTxId)
		.map((tx) => toDraftTransaction(tx));
	const transactions = pairTransactions(
		[...mutated, ...historicalAdded],
		ledger.accounts,
	);
	const accounts = ledger.accounts.map((account) =>
		toNormalizedAccount(
			account,
			account.account_id !== GOLDEN_ACCOUNT_IDS.disabledChecking,
		),
	);
	return sortNormalizedState({
		accounts,
		transactions,
		aggregates: aggregatesFor(accounts, transactions),
	});
}

export function projectExpectedInitialState(
	ledgerToday: string = LEDGER_TODAY,
): NormalizedFinancialState {
	return projectNormalizedState("initial", ledgerToday, []);
}

export function projectExpectedFinalState(
	ledgerToday: string = LEDGER_TODAY,
): NormalizedFinancialState {
	return projectNormalizedState("final", ledgerToday);
}

export function assembleNormalizedState(input: {
	accounts: NormalizedAccount[];
	transactions: NormalizedTransaction[];
}): NormalizedFinancialState {
	return sortNormalizedState({
		accounts: input.accounts,
		transactions: input.transactions,
		aggregates: aggregatesFor(input.accounts, input.transactions),
	});
}
