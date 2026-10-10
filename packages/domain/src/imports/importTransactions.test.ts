import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	AccountSummary,
	DashboardTransaction,
	ImportMappingTemplateRecord,
} from "@moat/data-access";
import type { AppContext } from "../context";
import {
	commitTransactionImport,
	fingerprintImportRow,
	IMPORT_UNCATEGORIZED_WARNING,
	previewTransactionImport,
	resolveImportRows,
	TransactionImportError,
} from "./importTransactions";

function checkingAccount(
	overrides: Partial<AccountSummary> = {},
): AccountSummary {
	return {
		id: "acct-1",
		name: "Chase Checking",
		type: "depository",
		subtype: "checking",
		currentBalance: 100,
		currency: "USD",
		mask: "1234",
		isHidden: false,
		isActive: true,
		...overrides,
	};
}

function makeCtx(
	input: {
		existing?: DashboardTransaction[];
		fingerprints?: string[];
		legacyRows?: Array<{ date: Date; amount: number; description: string }>;
		accounts?: AccountSummary[];
		storedAccountFingerprint?: string | null;
		templates?: ImportMappingTemplateRecord[];
	} = {},
): {
	ctx: AppContext;
	created: Array<Record<string, unknown>>;
} {
	const created: Array<Record<string, unknown>> = [];
	const fingerprintSet = new Set(input.fingerprints ?? []);
	const templates = input.templates ?? [];
	const ctx = {
		userId: "user-1",
		repositories: {
			transactions: {
				listRecent: async () => input.existing ?? [],
				findFingerprints: async ({
					fingerprints,
				}: {
					fingerprints: string[];
				}) => fingerprints.filter((value) => fingerprintSet.has(value)),
				findAccountFingerprint: input.storedAccountFingerprint
					? async () => input.storedAccountFingerprint ?? null
					: undefined,
				listUnfingerprintedForDedupe: input.legacyRows
					? async () => input.legacyRows ?? []
					: undefined,
				createMany: async (createInput: {
					transactions: Array<Record<string, unknown>>;
				}) => {
					created.push(...createInput.transactions);
					return createInput.transactions.length;
				},
			},
			accounts: {
				listAll: async () => input.accounts ?? [],
			},
			importMappingTemplates: {
				list: async () => templates,
				findById: async ({ id }: { id: string }) =>
					templates.find((template) => template.id === id) ?? null,
				create: async () => templates[0],
				update: async () => templates[0],
				delete: async () => undefined,
			},
		},
	} as unknown as AppContext;
	return { ctx, created };
}

describe("resolveImportRows", () => {
	it("normalizes JSON rows without CSV", () => {
		const resolved = resolveImportRows({
			rows: [
				{
					date: "2026-08-01",
					amount: 12.5,
					type: "EXPENSE",
					description: "Coffee",
				},
			],
		});
		assert.equal(resolved.normalized.length, 1);
		assert.equal(resolved.invalidCount, 0);
		assert.equal(resolved.normalized[0]?.description, "Coffee");
		assert.equal(resolved.normalized[0]?.amount, 12.5);
		assert.ok(resolved.normalized[0]?.dedupKey);
	});

	it("maps a mapping draft of keyed raw rows", () => {
		const resolved = resolveImportRows({
			mapping: {
				date: "Posted",
				amount: "Amt",
				description: "Memo",
			},
			rawRows: [{ Posted: "2026-08-02", Amt: "-40.00", Memo: "Groceries" }],
		});
		assert.equal(resolved.normalized.length, 1);
		assert.equal(resolved.normalized[0]?.type, "EXPENSE");
		assert.equal(resolved.normalized[0]?.description, "Groceries");
	});

	it("parses csvText with a mapping", () => {
		const resolved = resolveImportRows({
			csvText: "Date,Amount,Memo\n2026-08-05,15.00,Snack",
			mapping: { date: "Date", amount: "Amount", description: "Memo" },
		});
		assert.equal(resolved.normalized.length, 1);
		assert.equal(resolved.normalized[0]?.description, "Snack");
	});

	it("strips a UTF-8 BOM so bank exports still map", () => {
		const resolved = resolveImportRows({
			csvText: "\uFEFFDate,Amount,Memo\n2026-08-05,15.00,Snack",
			mapping: { date: "Date", amount: "Amount", description: "Memo" },
		});
		assert.equal(resolved.normalized.length, 1);
		assert.equal(resolved.normalized[0]?.description, "Snack");
	});

	it("rejects mixed sources", () => {
		assert.throws(
			() =>
				resolveImportRows({
					rows: [{ date: "2026-08-01", amount: 1 }],
					csvText: "Date,Amount\n2026-08-01,1",
					mapping: { date: "Date", amount: "Amount" },
				}),
			(error: unknown) =>
				error instanceof TransactionImportError &&
				error.code === "INVALID_SOURCE",
		);
	});

	it("rejects more than 5000 source rows", () => {
		const rows = Array.from({ length: 5001 }, (_, index) => ({
			date: "2026-08-01",
			amount: index + 1,
			description: `Row ${index}`,
		}));
		assert.throws(
			() => resolveImportRows({ rows }),
			(error: unknown) =>
				error instanceof TransactionImportError &&
				error.code === "TOO_MANY_ROWS",
		);
	});
});

describe("previewTransactionImport", () => {
	it("skips rows whose fingerprint already exists", async () => {
		const incoming = {
			date: new Date("2026-08-01T00:00:00.000Z"),
			amount: 12.5,
			description: "Coffee",
		};
		const fingerprint = fingerprintImportRow(incoming, null);
		const { ctx } = makeCtx({ fingerprints: [fingerprint] });
		const preview = await previewTransactionImport(ctx, {
			rows: [
				{
					date: "2026-08-01T00:00:00.000Z",
					amount: 12.5,
					description: "Coffee",
				},
				{
					date: "2026-08-03T00:00:00.000Z",
					amount: 9,
					description: "Tea",
				},
			],
		});
		assert.equal(preview.duplicateCount, 1);
		assert.equal(preview.newCount, 1);
		assert.equal(preview.rows[0]?.description, "Tea");
		assert.equal(preview.sample.length, 1);
		assert.ok(preview.rows[0]?.dedupeFingerprint);
	});

	it("does not treat the same file as a duplicate on a different account", async () => {
		const checking = checkingAccount();
		const savings = checkingAccount({
			id: "acct-2",
			name: "Chase Savings",
			subtype: "savings",
			mask: "5678",
		});
		const incoming = {
			date: new Date("2026-08-01T00:00:00.000Z"),
			amount: 12.5,
			description: "Coffee",
		};
		const checkingFingerprint = fingerprintImportRow(incoming, checking);
		const { ctx } = makeCtx({
			fingerprints: [checkingFingerprint],
			accounts: [checking, savings],
		});
		const preview = await previewTransactionImport(ctx, {
			accountId: savings.id,
			rows: [
				{
					date: "2026-08-01T00:00:00.000Z",
					amount: 12.5,
					description: "Coffee",
				},
			],
		});
		assert.equal(preview.duplicateCount, 0);
		assert.equal(preview.newCount, 1);
		assert.notEqual(preview.rows[0]?.dedupeFingerprint, checkingFingerprint);
	});

	it("keeps this bound when listing unfingerprinted rows from a class repo", async () => {
		class ClassTransactionRepo {
			db = { ready: true };
			async findFingerprints() {
				return [];
			}
			async listUnfingerprintedForDedupe() {
				if (this == null || this.db == null) {
					throw new TypeError(
						"Cannot read properties of undefined (reading 'db')",
					);
				}
				return [];
			}
			async createMany() {
				return 0;
			}
			async listRecent() {
				return [];
			}
		}
		const ctx = {
			userId: "user-1",
			repositories: {
				transactions: new ClassTransactionRepo(),
				accounts: { listAll: async () => [] },
			},
		} as unknown as AppContext;
		const preview = await previewTransactionImport(ctx, {
			rows: [{ date: "2026-08-01", amount: 1, description: "A" }],
		});
		assert.equal(preview.newCount, 1);
		assert.equal(preview.duplicateCount, 0);
	});

	it("falls back to the legacy signature for unfingerprinted rows", async () => {
		const { ctx } = makeCtx({
			legacyRows: [
				{
					date: new Date("2026-08-01T00:00:00.000Z"),
					amount: 12.5,
					description: "Coffee",
				},
			],
		});
		const preview = await previewTransactionImport(ctx, {
			rows: [
				{
					date: "2026-08-01T00:00:00.000Z",
					amount: 12.5,
					description: "Coffee",
				},
			],
		});
		assert.equal(preview.duplicateCount, 1);
		assert.equal(preview.newCount, 0);
	});

	it("skips duplicate rows inside the same file", async () => {
		const { ctx } = makeCtx();
		const preview = await previewTransactionImport(ctx, {
			rows: [
				{
					date: "2026-08-01T00:00:00.000Z",
					amount: 12.5,
					description: "Coffee",
				},
				{
					date: "2026-08-01T00:00:00.000Z",
					amount: 12.5,
					description: "Coffee",
				},
			],
		});
		assert.equal(preview.duplicateCount, 1);
		assert.equal(preview.newCount, 1);
	});

	it("uses a stored Plaid account fingerprint when present", async () => {
		const checking = checkingAccount();
		const incoming = {
			date: new Date("2026-08-01T00:00:00.000Z"),
			amount: 12.5,
			description: "Coffee",
		};
		const storedFingerprint = "plaid-account-fingerprint";
		const expected = fingerprintImportRow(
			incoming,
			checking,
			storedFingerprint,
		);
		const { ctx } = makeCtx({
			accounts: [checking],
			fingerprints: [expected],
			storedAccountFingerprint: storedFingerprint,
		});
		const preview = await previewTransactionImport(ctx, {
			accountId: checking.id,
			rows: [
				{
					date: "2026-08-01T00:00:00.000Z",
					amount: 12.5,
					description: "Coffee",
				},
			],
		});
		assert.equal(preview.duplicateCount, 1);
		assert.equal(preview.newCount, 0);
	});

	it("honors sampleSize up to 100", async () => {
		const { ctx } = makeCtx();
		const preview = await previewTransactionImport(ctx, {
			sampleSize: 2,
			rows: [
				{ date: "2026-08-01", amount: 1, description: "A" },
				{ date: "2026-08-02", amount: 2, description: "B" },
				{ date: "2026-08-03", amount: 3, description: "C" },
			],
		});
		assert.equal(preview.newCount, 3);
		assert.equal(preview.sample.length, 2);
	});

	it("pages the preview sample with sampleOffset", async () => {
		const { ctx } = makeCtx();
		const rows = [
			{ date: "2026-08-01", amount: 1, description: "A" },
			{ date: "2026-08-02", amount: 2, description: "B" },
			{ date: "2026-08-03", amount: 3, description: "C" },
		];
		const firstPage = await previewTransactionImport(ctx, {
			sampleSize: 2,
			sampleOffset: 0,
			rows,
		});
		const secondPage = await previewTransactionImport(ctx, {
			sampleSize: 2,
			sampleOffset: 2,
			rows,
		});
		assert.equal(firstPage.sample.length, 2);
		assert.equal(firstPage.sample[0]?.description, "A");
		assert.equal(secondPage.newCount, 3);
		assert.equal(secondPage.sample.length, 1);
		assert.equal(secondPage.sample[0]?.description, "C");
	});

	it("rejects an account that does not belong to the user", async () => {
		const { ctx } = makeCtx({ accounts: [checkingAccount()] });
		await assert.rejects(
			() =>
				previewTransactionImport(ctx, {
					accountId: "foreign-acct",
					rows: [{ date: "2026-08-01", amount: 1, description: "A" }],
				}),
			(error: unknown) =>
				error instanceof TransactionImportError &&
				error.code === "ACCOUNT_NOT_FOUND",
		);
	});
});

describe("commitTransactionImport", () => {
	it("writes only when confirmedNewCount matches", async () => {
		const { ctx, created } = makeCtx();
		const applied = await commitTransactionImport(ctx, {
			confirmedNewCount: 1,
			rows: [
				{
					date: "2026-08-04",
					amount: 20,
					type: "EXPENSE",
					description: "Books",
				},
			],
		});
		assert.equal(applied.status, "applied");
		if (applied.status === "applied") {
			assert.equal(applied.imported, 1);
			assert.equal(applied.newCount, 1);
			assert.equal(applied.transactionIds.length, 1);
		}
		assert.equal(created.length, 1);
		assert.equal(created[0]?.source, undefined);
		assert.equal(typeof created[0]?.id, "string");
		assert.equal(typeof created[0]?.dedupeFingerprint, "string");
	});

	it("persists the chosen account id and fingerprint", async () => {
		const account = checkingAccount();
		const { ctx, created } = makeCtx({ accounts: [account] });
		const applied = await commitTransactionImport(ctx, {
			accountId: account.id,
			confirmedNewCount: 1,
			rows: [
				{
					date: "2026-08-04",
					amount: 20,
					description: "Books",
				},
			],
		});
		assert.equal(applied.status, "applied");
		assert.equal(created[0]?.accountId, account.id);
		const expected = fingerprintImportRow(
			{
				date: new Date("2026-08-04T00:00:00.000Z"),
				amount: 20,
				description: "Books",
			},
			account,
		);
		assert.equal(created[0]?.dedupeFingerprint, expected);
	});

	it("refuses to write on confirmation mismatch", async () => {
		const { ctx, created } = makeCtx();
		const refused = await commitTransactionImport(ctx, {
			confirmedNewCount: 99,
			rows: [
				{
					date: "2026-08-04",
					amount: 20,
					description: "Books",
				},
			],
		});
		assert.equal(refused.status, "confirmation_mismatch");
		if (refused.status === "confirmation_mismatch") {
			assert.equal(refused.actualNewCount, 1);
		}
		assert.equal(created.length, 0);
	});

	it("persists a mapped memo column as originalDescription", async () => {
		const { ctx, created } = makeCtx();
		const committed = await commitTransactionImport(ctx, {
			confirmedNewCount: 1,
			csvText: "Date,Amount,Title,Memo\n2026-08-05,15.00,Snack,POS 1234",
			mapping: {
				date: "Date",
				amount: "Amount",
				description: "Title",
				memo: "Memo",
			},
		});
		assert.equal(committed.status, "applied");
		assert.equal(created[0]?.description, "Snack");
		assert.equal(created[0]?.originalDescription, "POS 1234");
	});

	it("warns when the category column is unmapped", async () => {
		const { ctx } = makeCtx();
		const preview = await previewTransactionImport(ctx, {
			csvText: "Date,Amount,Memo\n2026-08-05,15.00,Snack",
			mapping: { date: "Date", amount: "Amount", description: "Memo" },
		});
		assert.equal(preview.categoryColumnMapped, false);
		assert.equal(preview.uncategorizedWarning, IMPORT_UNCATEGORIZED_WARNING);
	});

	it("does not warn about uncategorized rows when every row is a duplicate", async () => {
		const first = await previewTransactionImport(makeCtx().ctx, {
			csvText: "Date,Amount,Memo\n2026-08-05,15.00,Snack",
			mapping: { date: "Date", amount: "Amount", description: "Memo" },
		});
		const fingerprint = first.rows[0]?.dedupeFingerprint;
		assert.ok(fingerprint);
		const { ctx } = makeCtx({ fingerprints: [fingerprint] });
		const preview = await previewTransactionImport(ctx, {
			csvText: "Date,Amount,Memo\n2026-08-05,15.00,Snack",
			mapping: { date: "Date", amount: "Amount", description: "Memo" },
		});
		assert.equal(preview.newCount, 0);
		assert.equal(preview.duplicateCount, 1);
		assert.equal(preview.categoryColumnMapped, false);
		assert.equal(preview.uncategorizedWarning, null);
	});

	it("resolves templateId into mapping and skips the warning when category is mapped", async () => {
		const { ctx } = makeCtx({
			templates: [
				{
					id: "tmpl-1",
					userId: "user-1",
					name: "Chase",
					isDefault: true,
					accountId: "acct-1",
					mapping: {
						date: "Date",
						description: "Memo",
						amount: "Amount",
						category: "Category",
					},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
			accounts: [checkingAccount()],
		});
		const preview = await previewTransactionImport(ctx, {
			csvText: "Date,Amount,Memo,Category\n2026-08-05,15.00,Snack,Groceries",
			templateId: "tmpl-1",
		});
		assert.equal(preview.newCount, 1);
		assert.equal(preview.categoryColumnMapped, true);
		assert.equal(preview.uncategorizedWarning, null);
		assert.equal(preview.sample[0]?.category, "Groceries");
	});

	it("lets request accountId override the template account", async () => {
		const { ctx, created } = makeCtx({
			templates: [
				{
					id: "tmpl-1",
					userId: "user-1",
					name: "Chase",
					isDefault: true,
					accountId: "acct-1",
					mapping: {
						date: "Date",
						description: "Memo",
						amount: "Amount",
					},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
			accounts: [
				checkingAccount(),
				checkingAccount({ id: "acct-2", name: "Savings" }),
			],
		});
		const applied = await commitTransactionImport(ctx, {
			csvText: "Date,Amount,Memo\n2026-08-05,15.00,Snack",
			templateId: "tmpl-1",
			accountId: "acct-2",
			confirmedNewCount: 1,
		});
		assert.equal(applied.status, "applied");
		assert.equal(created[0]?.accountId, "acct-2");
	});

	it("rejects mapping and templateId together", async () => {
		const { ctx } = makeCtx();
		await assert.rejects(
			() =>
				previewTransactionImport(ctx, {
					csvText: "Date,Amount\n2026-08-05,15.00",
					mapping: { date: "Date", amount: "Amount" },
					templateId: "tmpl-1",
				}),
			(error: unknown) =>
				error instanceof TransactionImportError &&
				error.code === "INVALID_SOURCE",
		);
	});

	it("rejects an unknown templateId", async () => {
		const { ctx } = makeCtx();
		await assert.rejects(
			() =>
				previewTransactionImport(ctx, {
					csvText: "Date,Amount\n2026-08-05,15.00",
					templateId: "missing",
				}),
			(error: unknown) =>
				error instanceof TransactionImportError &&
				error.code === "TEMPLATE_NOT_FOUND",
		);
	});
});
