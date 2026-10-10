import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Transaction as PlaidTransaction } from "plaid";

Object.assign(process.env, { NODE_ENV: "development" });

import {
	APPLE_FINANCEKIT_IMPORT_SIGNAL_SUMMARY_EVENT,
	createAppleFinanceKitImportSignalAccumulator,
	logAppleFinanceKitImportSignalSummary,
	recordAppleFinanceKitImportSignal,
} from "./apple-financekit-import-signal-logging";
import {
	logUncategorizedAppleFinanceKitTransactionImport,
	logUncategorizedPlaidTransactionImport,
	UNCATEGORIZED_TRANSACTION_IMPORT_TAG,
} from "./uncategorized-transaction-import-logging";

function plaidTx(overrides: Partial<PlaidTransaction> = {}): PlaidTransaction {
	return {
		transaction_id: "plaid-tx-12345678",
		amount: 12.34,
		...overrides,
	} as PlaidTransaction;
}

describe("uncategorized transaction import logging", () => {
	it("exports a stable axiom filter tag", () => {
		assert.equal(
			UNCATEGORIZED_TRANSACTION_IMPORT_TAG,
			"uncategorized_transaction_import",
		);
	});

	it("logs plaid uncategorized imports with provider category context", async () => {
		const originalInfo = console.log;
		const logs: string[] = [];
		console.log = (message?: unknown) => {
			logs.push(String(message));
		};

		try {
			logUncategorizedPlaidTransactionImport({
				userId: "user-1",
				plaidTx: plaidTx({
					personal_finance_category: {
						primary: "UNKNOWN_PRIMARY",
						detailed: "UNKNOWN_DETAILED",
						confidence_level: "LOW",
					},
					category: ["Payment"],
					category_id: "123",
					iso_currency_code: "USD",
					pending: false,
				}),
				mappedCategory: "Uncategorized",
				resolvedCategoryId: "uncat-id",
				uncategorizedCategoryId: "uncat-id",
				importKind: "added",
				preservesExistingCategory: false,
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			assert.equal(logs.length, 1);
			assert.match(logs[0] ?? "", /uncategorized_transaction_import/);
			assert.match(logs[0] ?? "", /pfcPrimary="UNKNOWN_PRIMARY"/);
			assert.match(logs[0] ?? "", /legacyCategory=\["Payment"\]/);
		} finally {
			console.log = originalInfo;
		}
	});

	it("skips plaid logging when user-managed category is preserved", async () => {
		const originalInfo = console.log;
		const logs: string[] = [];
		console.log = (message?: unknown) => {
			logs.push(String(message));
		};

		try {
			logUncategorizedPlaidTransactionImport({
				userId: "user-1",
				plaidTx: plaidTx(),
				mappedCategory: "Uncategorized",
				resolvedCategoryId: "uncat-id",
				uncategorizedCategoryId: "uncat-id",
				importKind: "modified",
				preservesExistingCategory: true,
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			assert.equal(logs.length, 0);
		} finally {
			console.log = originalInfo;
		}
	});

	it("logs apple wallet uncategorized imports with mcc context", async () => {
		const originalInfo = console.log;
		const logs: string[] = [];
		console.log = (message?: unknown) => {
			logs.push(String(message));
		};

		try {
			logUncategorizedAppleFinanceKitTransactionImport({
				userId: "user-1",
				transaction: {
					externalTransactionId: "apple-tx-12345678",
					rawCategory: "9999",
					category: null,
					currency: "USD",
					pending: false,
					merchantName: "Secret Merchant",
					description: "Secret Description",
					transactionType: "pointOfSale",
					foreignCurrencyCode: "EUR",
					creditDebitIndicator: "debit",
				},
				mappedCategory: "Uncategorized",
				mappingReason: "unknown_mcc",
				resolvedCategoryId: "uncat-id",
				uncategorizedCategoryId: "uncat-id",
				importKind: "added",
				preservesExistingCategory: false,
				accountCurrency: "USD",
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			assert.equal(logs.length, 1);
			assert.match(logs[0] ?? "", /merchantCategoryCode="9999"/);
			assert.match(logs[0] ?? "", /mappingReason="unknown_mcc"/);
			assert.match(logs[0] ?? "", /hasTransactionType=true/);
			assert.match(logs[0] ?? "", /transactionType="pointOfSale"/);
			assert.match(logs[0] ?? "", /hasForeignCurrency=true/);
			assert.match(logs[0] ?? "", /foreignCurrencyCode="EUR"/);
			assert.match(logs[0] ?? "", /availableCategorySignalNames=/);
			assert.doesNotMatch(logs[0] ?? "", /Secret Merchant/);
			assert.doesNotMatch(logs[0] ?? "", /Secret Description/);
		} finally {
			console.log = originalInfo;
		}
	});

	it("logs apple unsupported transaction type without merchant values", async () => {
		const originalInfo = console.log;
		const logs: string[] = [];
		console.log = (message?: unknown) => {
			logs.push(String(message));
		};

		try {
			logUncategorizedAppleFinanceKitTransactionImport({
				userId: "user-1",
				transaction: {
					externalTransactionId: "apple-tx-abcdef12",
					rawCategory: null,
					category: null,
					currency: "USD",
					pending: false,
					merchantName: "Coffee Shop LLC",
					description: "LATTE ORDER #42",
					transactionType: "pointOfSale",
				},
				mappedCategory: "Uncategorized",
				mappingReason: "unsupported_transaction_type",
				resolvedCategoryId: "uncat-id",
				uncategorizedCategoryId: "uncat-id",
				importKind: "added",
				preservesExistingCategory: false,
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			assert.equal(logs.length, 1);
			assert.match(
				logs[0] ?? "",
				/mappingReason="unsupported_transaction_type"/,
			);
			assert.match(logs[0] ?? "", /hasMerchantName=true/);
			assert.match(logs[0] ?? "", /hasDescription=true/);
			assert.doesNotMatch(logs[0] ?? "", /Coffee Shop LLC/);
			assert.doesNotMatch(logs[0] ?? "", /LATTE ORDER/);
		} finally {
			console.log = originalInfo;
		}
	});
});

describe("apple financekit import signal summary logging", () => {
	it("exports a stable summary event name", () => {
		assert.equal(
			APPLE_FINANCEKIT_IMPORT_SIGNAL_SUMMARY_EVENT,
			"apple_financekit_import_signal_summary",
		);
	});

	it("accumulates batch summary counts without logging PII", async () => {
		const accumulator = createAppleFinanceKitImportSignalAccumulator();

		recordAppleFinanceKitImportSignal({
			accumulator,
			transaction: {
				rawCategory: "5812",
				currency: "USD",
				description: "Should Not Appear",
				merchantName: "Hidden Cafe",
				pending: false,
				transactionType: "pointOfSale",
			},
			mappedCategory: "Eating Out",
			mappingReason: "mapped_from_mcc",
			accountCurrency: "USD",
		});

		recordAppleFinanceKitImportSignal({
			accumulator,
			transaction: {
				rawCategory: null,
				currency: "EUR",
				description: "Fee",
				merchantName: null,
				pending: false,
				transactionType: "fee",
				foreignCurrencyCode: "EUR",
			},
			mappedCategory: "Fees",
			mappingReason: "mapped_from_transaction_type",
			accountCurrency: "USD",
		});

		recordAppleFinanceKitImportSignal({
			accumulator,
			transaction: {
				rawCategory: null,
				currency: "USD",
				description: "Purchase",
				merchantName: "Store",
				pending: false,
				transactionType: "pointOfSale",
			},
			mappedCategory: "Uncategorized",
			mappingReason: "unsupported_transaction_type",
			accountCurrency: "USD",
		});

		assert.equal(accumulator.totalTransactions, 3);
		assert.equal(accumulator.withMerchantCategoryCode, 1);
		assert.equal(accumulator.withoutMerchantCategoryCode, 2);
		assert.equal(accumulator.withTransactionType, 3);
		assert.equal(accumulator.withoutTransactionType, 0);
		assert.equal(accumulator.withAnyProviderCategorySignal, 3);
		assert.equal(accumulator.withoutAnyProviderCategorySignal, 0);
		assert.equal(accumulator.mappedToInternalCategory, 2);
		assert.equal(accumulator.mappedToUncategorized, 1);
		assert.equal(accumulator.mappingReasonCounts.mapped_from_mcc, 1);
		assert.equal(
			accumulator.mappingReasonCounts.mapped_from_transaction_type,
			1,
		);
		assert.equal(accumulator.transactionTypeCounts.fee, 1);
		assert.equal(accumulator.transactionTypeCounts.pointOfSale, 2);
		assert.equal(accumulator.merchantCategoryCodeCounts["5812"], 1);
		assert.equal(accumulator.currencyCodeCounts.USD, 2);
		assert.equal(accumulator.currencyCodeCounts.EUR, 1);
		assert.equal(accumulator.withForeignCurrency, 1);

		const originalInfo = console.log;
		const logs: string[] = [];
		console.log = (message?: unknown) => {
			logs.push(String(message));
		};

		try {
			logAppleFinanceKitImportSignalSummary({
				userId: "user-1",
				externalAccountIdPrefix: "acct-12345678",
				accountCurrency: "USD",
				accumulator,
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			assert.equal(logs.length, 1);
			assert.match(logs[0] ?? "", /apple_financekit_import_signal_summary/);
			assert.match(logs[0] ?? "", /totalTransactions=3/);
			assert.match(logs[0] ?? "", /withMerchantCategoryCode=1/);
			assert.match(logs[0] ?? "", /withoutTransactionType=0/);
			assert.doesNotMatch(logs[0] ?? "", /Hidden Cafe/);
			assert.doesNotMatch(logs[0] ?? "", /Should Not Appear/);
		} finally {
			console.log = originalInfo;
		}
	});
});
