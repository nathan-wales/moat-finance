import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import type { CreateTransactionInput } from "@moat/data-access";
import { createSqliteClientHandle } from "./createSqliteClient";
import type { SqliteDbClient } from "./db-client";
import { runMigrations } from "./migrations";
import { SqliteTransactionRepository } from "./repositories/SqliteTransactionRepository";

function tempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "moat-import-acct-"));
}

async function seed(): Promise<{
	db: SqliteDbClient;
	close: () => Promise<void>;
	userId: string;
	manualAccountId: string;
	plaidAccountId: string;
}> {
	const dir = tempDir();
	const dbPath = path.join(dir, "moat.db");
	const handle = createSqliteClientHandle(dbPath, { key: randomBytes(32) });
	const db = handle.client;
	await runMigrations(db);

	const userId = "local-user";
	await db.localUser.create({ data: { id: userId } });

	const manualAccountId = randomUUID();
	await db.account.create({
		data: {
			id: manualAccountId,
			userId,
			name: "Cash",
			type: "depository",
			subtype: "checking",
			mask: "1111",
		},
	});

	const plaidItemId = randomUUID();
	await db.plaidItem.create({
		data: {
			id: plaidItemId,
			plaidItemId: `plaid-item-${plaidItemId}`,
			userId,
			institutionName: "Test Bank",
		},
	});
	const plaidAccountId = randomUUID();
	await db.plaidAccount.upsert({
		where: { plaidAccountId: `plaid-acct-${plaidAccountId}` },
		create: {
			id: plaidAccountId,
			plaidAccountId: `plaid-acct-${plaidAccountId}`,
			plaidItemId,
			name: "Checking",
			type: "depository",
			mask: "7566",
		},
		update: {},
	});

	return {
		db,
		close: () => handle.close(),
		userId,
		manualAccountId,
		plaidAccountId,
	};
}

function importRow(accountId: string | null): CreateTransactionInput {
	return {
		id: randomUUID(),
		date: new Date("2026-08-01T00:00:00.000Z"),
		amount: 8.6,
		type: "EXPENSE",
		description: "Imported",
		accountId,
	};
}

describe("SqliteTransactionRepository.createMany account links", () => {
	const cleanups: Array<() => Promise<void>> = [];
	afterEach(async () => {
		for (const close of cleanups.splice(0)) {
			await close();
		}
	});

	it("stores a Plaid picker id on plaidAccountId instead of Account", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);
		const repo = new SqliteTransactionRepository(seeded.db);

		const imported = await repo.createMany({
			userId: seeded.userId,
			transactions: [importRow(seeded.plaidAccountId)],
		});
		assert.equal(imported, 1);

		const row = (await seeded.db.transaction.findFirst({
			where: { userId: seeded.userId },
			select: { accountId: true, plaidAccountId: true },
		})) as { accountId: string | null; plaidAccountId: string | null } | null;
		assert.equal(row?.accountId, null);
		assert.equal(row?.plaidAccountId, seeded.plaidAccountId);
	});

	it("stores a manual Account picker id on accountId", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);
		const repo = new SqliteTransactionRepository(seeded.db);

		const imported = await repo.createMany({
			userId: seeded.userId,
			transactions: [importRow(seeded.manualAccountId)],
		});
		assert.equal(imported, 1);

		const row = (await seeded.db.transaction.findFirst({
			where: { userId: seeded.userId },
			select: { accountId: true, plaidAccountId: true },
		})) as { accountId: string | null; plaidAccountId: string | null } | null;
		assert.equal(row?.accountId, seeded.manualAccountId);
		assert.equal(row?.plaidAccountId, null);
	});

	it("does not fail the bulk insert when the picker id is a Plaid account", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);
		const repo = new SqliteTransactionRepository(seeded.db);

		const imported = await repo.createMany({
			userId: seeded.userId,
			transactions: Array.from({ length: 3 }, () =>
				importRow(seeded.plaidAccountId),
			),
		});
		assert.equal(imported, 3);
	});
});
