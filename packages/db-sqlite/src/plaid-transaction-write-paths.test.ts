/**
 * Regression coverage for the Plaid sync write paths against the real
 * encrypted adapter. Guards against three production failures:
 *   1. Partial unique index breaking Prisma's targeted ON CONFLICT upsert.
 *   2. Nested/implicit transactions deadlocking the adapter mutex.
 *   3. Chunked interactive-transaction writes hanging instead of completing.
 * Each write is raced against a timeout so a deadlock fails fast instead of
 * hanging the suite.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { createSqliteClientHandle } from "./createSqliteClient";
import type { SqliteDbClient } from "./db-client";
import { runMigrations } from "./migrations";

function tempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "moat-sync-write-"));
}

async function withTimeout<T>(
	label: string,
	promise: Promise<T>,
	ms: number,
): Promise<"ok" | "timeout"> {
	let timer: NodeJS.Timeout | undefined;
	const raced = await Promise.race([
		promise.then(() => "ok" as const),
		new Promise<"timeout">((resolve) => {
			timer = setTimeout(() => resolve("timeout"), ms);
		}),
	]);
	if (timer) clearTimeout(timer);
	return raced;
}

type Seeded = {
	db: SqliteDbClient;
	close: () => Promise<void>;
	userId: string;
	plaidItemDbId: string;
	plaidAccountDbId: string;
	categoryId: string;
};

async function seed(): Promise<Seeded> {
	const dir = tempDir();
	const dbPath = path.join(dir, "moat.db");
	const handle = createSqliteClientHandle(dbPath, { key: randomBytes(32) });
	const db = handle.client;
	await runMigrations(db);

	const userId = "local-user";
	await db.localUser.create({ data: { id: userId } });
	const categoryId = randomUUID();
	await db.category.create({
		data: { id: categoryId, name: "Uncategorized", userId: null },
	});
	const plaidItemDbId = randomUUID();
	await db.plaidItem.create({
		data: {
			id: plaidItemDbId,
			plaidItemId: `plaid-item-${plaidItemDbId}`,
			userId,
			institutionName: "Test Bank",
		},
	});
	const plaidAccountDbId = randomUUID();
	await db.plaidAccount.upsert({
		where: { plaidAccountId: `plaid-acct-${plaidAccountDbId}` },
		create: {
			id: plaidAccountDbId,
			plaidAccountId: `plaid-acct-${plaidAccountDbId}`,
			plaidItemId: plaidItemDbId,
			name: "Checking",
			type: "depository",
		},
		update: {},
	});

	return {
		db,
		close: () => handle.close(),
		userId,
		plaidItemDbId,
		plaidAccountDbId,
		categoryId,
	};
}

function fakeTransactionCreate(seeded: Seeded, index: number) {
	const externalId = `plaid-tx-${index}`;
	const postedDate = new Date(Date.UTC(2026, 0, 1 + (index % 300)));
	return {
		externalId,
		create: {
			id: randomUUID(),
			userId: seeded.userId,
			accountId: null,
			categoryId: seeded.categoryId,
			date: postedDate,
			postedDate,
			amount: 12.34 + index,
			merchantName: `Merchant ${index}`,
			description: `Purchase number ${index} at some store`,
			type: "EXPENSE",
			pending: false,
			hidden: false,
			source: "PLAID",
			removedAt: null,
			externalTransactionId: externalId,
			plaidAccountId: seeded.plaidAccountDbId,
			plaidItemId: seeded.plaidItemDbId,
			pendingTransactionId: null,
			raw: JSON.stringify({
				transaction_id: externalId,
				account_id: `plaid-acct-${seeded.plaidAccountDbId}`,
				amount: 12.34 + index,
				iso_currency_code: "USD",
				name: `Purchase number ${index} at some store`,
				merchant_name: `Merchant ${index}`,
				pending: false,
				date: postedDate.toISOString().slice(0, 10),
				location: {
					address: "123 Main St",
					city: "Springfield",
					region: "IL",
					postal_code: "62701",
					country: "US",
					lat: 39.78,
					lon: -89.65,
					store_number: "42",
				},
				payment_channel: "in store",
				personal_finance_category: {
					primary: "GENERAL_MERCHANDISE",
					detailed: "GENERAL_MERCHANDISE_OTHER",
				},
			}),
			location: JSON.stringify({
				address: "123 Main St",
				city: "Springfield",
				region: "IL",
				postal_code: "62701",
				country: "US",
				lat: 39.78,
				lon: -89.65,
				store_number: "42",
			}),
		},
	};
}

describe("plaid transaction write paths", () => {
	const cleanups: Array<() => Promise<void>> = [];
	afterEach(async () => {
		for (const close of cleanups.splice(0)) {
			await close();
		}
	});

	it("runs 100 direct upserts (current app write path)", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);

		async function run(): Promise<void> {
			for (let i = 0; i < 100; i += 1) {
				const { externalId, create } = fakeTransactionCreate(seeded, i);
				await seeded.db.transaction.upsert({
					where: {
						userId_externalTransactionId: {
							userId: seeded.userId,
							externalTransactionId: externalId,
						},
					},
					create,
					update: { merchantName: create.merchantName },
				});
			}
		}

		const result = await withTimeout("direct-upserts", run(), 15_000);
		assert.equal(result, "ok");
		const count = await seeded.db.transaction.count({
			where: { userId: seeded.userId },
		});
		assert.equal(count, 100);
	});

	it("runs 100 upserts inside one interactive transaction (old app write path)", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);

		async function run(): Promise<void> {
			await seeded.db.$transaction(async (tx) => {
				for (let i = 0; i < 100; i += 1) {
					const { externalId, create } = fakeTransactionCreate(seeded, i);
					await tx.transaction.upsert({
						where: {
							userId_externalTransactionId: {
								userId: seeded.userId,
								externalTransactionId: externalId,
							},
						},
						create,
						update: { merchantName: create.merchantName },
					});
				}
			});
		}

		const result = await withTimeout("itx-upserts", run(), 15_000);
		assert.equal(result, "ok");
		const count = await seeded.db.transaction.count({
			where: { userId: seeded.userId },
		});
		assert.equal(count, 100);
	});

	it("runs createMany inside an interactive transaction (original failing path)", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);

		async function run(): Promise<void> {
			await seeded.db.$transaction(async (tx) => {
				const creates = Array.from(
					{ length: 100 },
					(_, i) => fakeTransactionCreate(seeded, i).create,
				);
				await tx.transaction.createMany({ data: creates });
			});
		}

		const result = await withTimeout("itx-createMany", run(), 15_000);
		assert.equal(result, "ok");
		const count = await seeded.db.transaction.count({
			where: { userId: seeded.userId },
		});
		assert.equal(count, 100);
	});

	it("rebuilds the legacy partial upsert index so existing installs recover", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);

		await seeded.db.$executeRaw`DROP INDEX "Transaction_userId_externalTransactionId_key"`;
		await seeded.db.$executeRaw`
			CREATE UNIQUE INDEX "Transaction_userId_externalTransactionId_key"
			ON "Transaction" ("userId", "externalTransactionId")
			WHERE "externalTransactionId" IS NOT NULL
		`;

		await runMigrations(seeded.db);

		const indexSql = await seeded.db.$queryRaw<Array<{ sql: string | null }>>`
			SELECT "sql" FROM sqlite_master
			WHERE type = 'index'
				AND name = 'Transaction_userId_externalTransactionId_key'
		`;
		assert.equal(indexSql.length, 1);
		assert.doesNotMatch(indexSql[0]?.sql ?? "", /\bWHERE\b/i);

		const { externalId, create } = fakeTransactionCreate(seeded, 0);
		await seeded.db.transaction.upsert({
			where: {
				userId_externalTransactionId: {
					userId: seeded.userId,
					externalTransactionId: externalId,
				},
			},
			create,
			update: {},
		});
		const count = await seeded.db.transaction.count({
			where: { userId: seeded.userId },
		});
		assert.equal(count, 1);
	});

	it("upserts still work after a prior completed interactive transaction", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);

		await seeded.db.$transaction(async (tx) => {
			await tx.plaidItem.update({
				where: { id: seeded.plaidItemDbId },
				data: { lastSyncAt: new Date() },
			});
		});

		async function run(): Promise<void> {
			const { externalId, create } = fakeTransactionCreate(seeded, 0);
			await seeded.db.transaction.upsert({
				where: {
					userId_externalTransactionId: {
						userId: seeded.userId,
						externalTransactionId: externalId,
					},
				},
				create,
				update: {},
			});
		}

		const result = await withTimeout("post-itx-upsert", run(), 15_000);
		assert.equal(result, "ok");
	});
});
// #endregion
