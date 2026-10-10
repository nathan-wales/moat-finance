import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	APPLE_FINANCEKIT_BULK_IMPORT_WRITE_CHUNK_SIZE,
	AppleFinanceKitAccountNotFoundError,
	bulkImportAppleFinanceKitTransactionsInputSchema,
	chunkArray,
	omitMappedCategoryFromUpdate,
	partitionAppleFinanceKitWritesForLiveExisting,
	requireAppleFinanceKitAccount,
	upsertAppleFinanceKitAccountsInputSchema,
} from "./apple-financekit-import.service";
import {
	buildAppleFinanceKitExternalTransactionId,
	mapAppleFinanceKitCategory,
	mapAppleFinanceKitCategoryDetailed,
	mapAppleFinanceKitTransactionType,
	parseAppleFinanceKitDate,
} from "./apple-financekit-mapping";
import { categoryFromMerchantCategoryCode } from "./apple-financekit-mcc-mapping";

describe("apple-financekit-mapping", () => {
	it("maps known Apple categories to app categories", () => {
		assert.equal(mapAppleFinanceKitCategory("RESTAURANTS"), "Eating Out");
		assert.equal(mapAppleFinanceKitCategory("GROCERIES"), "Groceries");
		assert.equal(mapAppleFinanceKitCategory(null), "Uncategorized");
	});

	it("maps FinanceKit MCC codes to app categories", () => {
		assert.equal(categoryFromMerchantCategoryCode("5812"), "Eating Out");
		assert.equal(categoryFromMerchantCategoryCode("5411"), "Groceries");
		assert.equal(categoryFromMerchantCategoryCode("5541"), "Gas");
		assert.equal(mapAppleFinanceKitCategory("5812"), "Eating Out");
		assert.equal(
			mapAppleFinanceKitCategoryDetailed({ rawCategory: "5812" }).mappingReason,
			"mapped_from_mcc",
		);
	});

	it("maps fee and transfer transaction types when MCC is absent", () => {
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({ transactionType: "fee" }),
			{ category: "Fees", mappingReason: "mapped_from_transaction_type" },
		);
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({ transactionType: "transfer" }),
			{ category: "Transfer", mappingReason: "mapped_from_transaction_type" },
		);
	});

	it("maps deposit and withdrawal without MCC to Transfer", () => {
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({
				transactionType: "deposit",
				creditDebitIndicator: "credit",
			}),
			{ category: "Transfer", mappingReason: "mapped_from_transaction_type" },
		);
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({
				transactionType: "withdrawal",
				creditDebitIndicator: "debit",
			}),
			{ category: "Transfer", mappingReason: "mapped_from_transaction_type" },
		);
	});

	it("maps directDeposit credits to Salary and debits to Transfer", () => {
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({
				transactionType: "directDeposit",
				creditDebitIndicator: "credit",
			}),
			{ category: "Salary", mappingReason: "mapped_from_transaction_type" },
		);
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({
				transactionType: "directDeposit",
				creditDebitIndicator: "debit",
			}),
			{ category: "Transfer", mappingReason: "mapped_from_transaction_type" },
		);
	});

	it("maps interest by credit or debit direction", () => {
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({
				transactionType: "interest",
				creditDebitIndicator: "credit",
			}),
			{ category: "Salary", mappingReason: "mapped_from_transaction_type" },
		);
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({
				transactionType: "interest",
				creditDebitIndicator: "debit",
			}),
			{ category: "Fees", mappingReason: "mapped_from_transaction_type" },
		);
	});

	it("does not treat currency-only payloads as category signals", () => {
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({
				rawCategory: null,
				transactionType: null,
				amount: 12,
			}),
			{ category: "Uncategorized", mappingReason: "no_provider_category" },
		);
	});

	it("marks unsupported and unknown transaction types without forcing a category", () => {
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({ transactionType: "pointOfSale" }),
			{
				category: "Uncategorized",
				mappingReason: "unsupported_transaction_type",
			},
		);
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({ transactionType: "unknown" }),
			{
				category: "Uncategorized",
				mappingReason: "unsupported_transaction_type",
			},
		);
		assert.deepEqual(
			mapAppleFinanceKitCategoryDetailed({ transactionType: "refund" }),
			{
				category: "Uncategorized",
				mappingReason: "unsupported_transaction_type",
			},
		);
	});

	it("returns Uncategorized when no MCC is provided", () => {
		assert.equal(mapAppleFinanceKitCategory(null), "Uncategorized");
		assert.equal(mapAppleFinanceKitCategory(undefined), "Uncategorized");
		assert.equal(mapAppleFinanceKitCategory(""), "Uncategorized");
	});

	it("parses Apple date strings", () => {
		const parsed = parseAppleFinanceKitDate("2026-05-25");
		assert.ok(parsed);
		assert.equal(parsed?.toISOString(), "2026-05-25T00:00:00.000Z");
	});

	it("builds prefixed external transaction ids", () => {
		assert.equal(
			buildAppleFinanceKitExternalTransactionId("tx-123"),
			"APPLE_FINANCEKIT:tx-123",
		);
	});

	it("maps transaction type from signed amount", () => {
		assert.equal(mapAppleFinanceKitTransactionType(-42.18), "INCOME");
		assert.equal(mapAppleFinanceKitTransactionType(42.18), "EXPENSE");
	});
});

describe("apple-financekit-import schemas", () => {
	it("validates account upsert payloads", () => {
		const parsed = upsertAppleFinanceKitAccountsInputSchema.parse({
			accounts: [
				{
					source: "APPLE_FINANCEKIT",
					externalAccountId: "apple-card-1",
					displayName: "Apple Card",
					institutionName: "Apple Wallet",
					accountType: "credit",
					accountSubtype: "credit_card",
					currency: "USD",
					currentBalance: 123.45,
					availableBalance: 5000,
				},
			],
		});

		assert.equal(parsed.accounts.length, 1);
		assert.equal(parsed.accounts[0]?.externalAccountId, "apple-card-1");
	});

	it("validates bulk transaction payloads", () => {
		const parsed = bulkImportAppleFinanceKitTransactionsInputSchema.parse({
			source: "APPLE_FINANCEKIT",
			externalAccountId: "apple-card-1",
			transactions: [
				{
					externalTransactionId: "tx-1",
					date: "2026-05-25",
					amount: -42.18,
					currency: "USD",
					description: "Target",
					pending: false,
				},
			],
		});

		assert.equal(parsed.transactions.length, 1);
		assert.equal(parsed.externalAccountId, "apple-card-1");
		assert.equal(parsed.transactions[0]?.transactionType, undefined);
	});

	it("accepts optional FinanceKit signal fields", () => {
		const parsed = bulkImportAppleFinanceKitTransactionsInputSchema.parse({
			source: "APPLE_FINANCEKIT",
			externalAccountId: "apple-card-1",
			transactions: [
				{
					externalTransactionId: "tx-2",
					date: "2026-05-25",
					amount: 4.5,
					currency: "USD",
					description: "ATM fee",
					pending: false,
					transactionType: "fee",
					foreignCurrencyCode: "EUR",
					creditDebitIndicator: "debit",
					rawCategory: null,
				},
			],
		});

		assert.equal(parsed.transactions[0]?.transactionType, "fee");
		assert.equal(parsed.transactions[0]?.foreignCurrencyCode, "EUR");
		assert.equal(parsed.transactions[0]?.creditDebitIndicator, "debit");
	});
});

describe("apple-financekit ownership validation", () => {
	it("throws when account is missing", () => {
		assert.throws(
			() => requireAppleFinanceKitAccount(null),
			AppleFinanceKitAccountNotFoundError,
		);
	});

	it("returns account when present", () => {
		const account = requireAppleFinanceKitAccount({
			id: "acct-1",
			displayName: "Apple Card",
			externalAccountId: "apple-card-1",
		});

		assert.equal(account.id, "acct-1");
	});
});

describe("apple-financekit deduplication keys", () => {
	it("uses stable prefixed ids for repeated imports", () => {
		const first = buildAppleFinanceKitExternalTransactionId("tx-abc");
		const second = buildAppleFinanceKitExternalTransactionId("tx-abc");
		assert.equal(first, second);
		assert.match(first, /^APPLE_FINANCEKIT:/);
	});
});

describe("apple-financekit unique-constraint write partition", () => {
	it("reclassifies prefetch misses as updates without overwriting category", () => {
		const { toCreate, toUpdate } =
			partitionAppleFinanceKitWritesForLiveExisting(
				[
					{
						externalTransactionId: "APPLE_FINANCEKIT:tx-1",
						existing: null,
						updateData: {
							category: "Eating Out",
							categoryId: "mapped-cat",
							amount: "12.00",
							pending: false,
						},
					},
				],
				new Map([["APPLE_FINANCEKIT:tx-1", { id: "db-row-1" }]]),
			);

		assert.equal(toCreate.length, 0);
		assert.equal(toUpdate.length, 1);
		assert.equal(toUpdate[0]?.existingId, "db-row-1");
		assert.equal(toUpdate[0]?.updateData.category, undefined);
		assert.equal(toUpdate[0]?.updateData.categoryId, undefined);
		assert.equal(toUpdate[0]?.updateData.amount, "12.00");
	});

	it("keeps prepared category updates when the row was already known", () => {
		const { toCreate, toUpdate } =
			partitionAppleFinanceKitWritesForLiveExisting(
				[
					{
						externalTransactionId: "APPLE_FINANCEKIT:tx-2",
						existing: { id: "db-row-2" },
						updateData: {
							category: "Groceries",
							categoryId: "mapped-cat",
							amount: "8.50",
						},
					},
				],
				new Map([["APPLE_FINANCEKIT:tx-2", { id: "db-row-2" }]]),
			);

		assert.equal(toCreate.length, 0);
		assert.equal(toUpdate[0]?.updateData.category, "Groceries");
		assert.equal(toUpdate[0]?.updateData.categoryId, "mapped-cat");
	});

	it("leaves rows in create when the live lookup is empty", () => {
		const row = {
			externalTransactionId: "APPLE_FINANCEKIT:tx-3",
			existing: null,
			updateData: { amount: "4.00" },
		};
		const { toCreate, toUpdate } =
			partitionAppleFinanceKitWritesForLiveExisting([row], new Map());

		assert.deepEqual(toCreate, [row]);
		assert.equal(toUpdate.length, 0);
	});

	it("strips only mapped category fields from a create-path update", () => {
		const updateData = omitMappedCategoryFromUpdate({
			category: "Fees",
			categoryId: "fees-id",
			pending: true,
			removedAt: null,
		});

		assert.equal(updateData.category, undefined);
		assert.equal(updateData.categoryId, undefined);
		assert.equal(updateData.pending, true);
		assert.equal(updateData.removedAt, null);
	});
});

describe("apple-financekit bulk import chunking", () => {
	it("uses a write chunk size that stays under interactive TX timeouts", () => {
		assert.ok(APPLE_FINANCEKIT_BULK_IMPORT_WRITE_CHUNK_SIZE <= 100);
		assert.ok(APPLE_FINANCEKIT_BULK_IMPORT_WRITE_CHUNK_SIZE > 0);
	});

	it("chunks arrays without dropping or duplicating items", () => {
		const values = Array.from({ length: 250 }, (_, index) => index);
		const chunks = chunkArray(values, 100);

		assert.equal(chunks.length, 3);
		assert.equal(chunks[0]?.length, 100);
		assert.equal(chunks[1]?.length, 100);
		assert.equal(chunks[2]?.length, 50);
		assert.deepEqual(chunks.flat(), values);
	});

	it("returns no chunks for an empty array", () => {
		assert.deepEqual(chunkArray([], 100), []);
	});

	it("rejects non-positive chunk sizes", () => {
		assert.throws(() => chunkArray([1], 0), /chunk size/);
	});
});
