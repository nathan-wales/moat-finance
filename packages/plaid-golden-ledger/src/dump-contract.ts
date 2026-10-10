/**
 * Cross-platform dump contract for Golden Ledger equality.
 *
 * Postgres and SQLite schemas diverge; dumps must use these mapped fields
 * rather than raw ORM rows.
 */
export const DUMP_ACCOUNT_FIELDS = [
	"providerAccountId",
	"name",
	"mask",
	"type",
	"subtype",
	"syncEnabled",
	"hidden",
	"currentBalance",
	"availableBalance",
] as const;

export const DUMP_TRANSACTION_FIELDS = [
	"providerTransactionId",
	"providerAccountId",
	"amount",
	"date",
	"category",
	"description",
	"type",
	"pending",
	"hidden",
	"autoHiddenAsTransfer",
	"removed",
	"transferPairKey",
	"hashtags",
] as const;

export const DUMP_AGGREGATE_FIELDS = [
	"spending",
	"income",
	"transfers",
	"netWorth",
] as const;

export const DUMP_SORT_KEYS = {
	accounts: ["providerAccountId"],
	transactions: ["providerAccountId", "providerTransactionId"],
	hashtags: ["value"],
} as const;

/**
 * How each dump field is sourced on each platform.
 *
 * | Dump field | Postgres | SQLite |
 * | providerAccountId | PlaidAccount.plaidAccountId | PlaidAccount.plaidAccountId |
 * | hidden (account) | PlaidAccount.accountHidden | PlaidAccount.isHidden |
 * | providerTransactionId | Transaction.externalTransactionId | Transaction.externalTransactionId |
 * | amount | Number(Decimal.toFixed(2)) | Number(Float.toFixed(2)) |
 * | category | Category.name via categoryId | Category.name via categoryId |
 * | date | COALESCE(postedDate, date) YYYY-MM-DD UTC | same |
 * | transferPairKey | sorted pair of partner externalTransactionIds | same |
 * | aggregates.spending | EXPENSE, not hidden, not removed, not hidden category | same via assembleNormalizedState |
 * | aggregates.income | INCOME, same scope | same |
 * | aggregates.transfers | EXPENSE amount where autoHiddenAsTransfer and not removed | same |
 * | aggregates.netWorth | accountNetWorthContribution of active, syncEnabled, not hidden accounts | same |
 *
 * Out of the shared dump: BalanceSnapshot, AccountBalanceHistory, FinancialConnection,
 * authorizedDate, dedupeFingerprint, splitGroupId, lastTransactionSyncAt, PlaidAccount.userId.
 */
export const CROSS_PLATFORM_FIELD_MAPPING = {
	accountHidden: {
		postgres: "PlaidAccount.accountHidden",
		sqlite: "PlaidAccount.isHidden",
		dump: "hidden",
	},
	transactionAmount: {
		postgres: "Decimal",
		sqlite: "Float",
		dump: "number via Number(x.toFixed(2))",
	},
	category: {
		postgres: "category string and categoryId",
		sqlite: "categoryId only",
		dump: "resolved Category.name",
	},
	providerTransactionId: {
		postgres: "externalTransactionId",
		sqlite: "externalTransactionId",
		dump: "providerTransactionId",
	},
	transferPair: {
		postgres: "Transaction.transferPairId UUID",
		sqlite: "Transaction.transferPairId UUID",
		dump: "sorted providerTransactionId pair",
	},
} as const;

export const HIDDEN_SPENDING_CATEGORY_NAMES = ["Transfer"] as const;

export function money(value: number): number {
	return Number(value.toFixed(2));
}
