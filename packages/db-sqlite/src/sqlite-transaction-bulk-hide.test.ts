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
	return fs.mkdtempSync(path.join(os.tmpdir(), "moat-bulk-hide-"));
}

async function seed(): Promise<{
	db: SqliteDbClient;
	close: () => Promise<void>;
	userId: string;
}> {
	const dir = tempDir();
	const dbPath = path.join(dir, "moat.db");
	const handle = createSqliteClientHandle(dbPath, { key: randomBytes(32) });
	const db = handle.client;
	await runMigrations(db);

	const userId = "local-user";
	await db.localUser.create({ data: { id: userId } });
	return { db, close: () => handle.close(), userId };
}

function row(index: number): CreateTransactionInput {
	return {
		id: randomUUID(),
		date: new Date(`2026-08-0${index}T00:00:00.000Z`),
		amount: 10 + index,
		type: "EXPENSE",
		description: `Row ${index}`,
	};
}

describe("SqliteTransactionRepository.bulkHide", () => {
	const cleanups: Array<() => Promise<void>> = [];
	afterEach(async () => {
		for (const close of cleanups.splice(0)) {
			await close();
		}
	});

	it("hides many transactions in one write without deleting them", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);
		const repo = new SqliteTransactionRepository(seeded.db);
		const transactions = [row(1), row(2), row(3)];
		const ids = transactions.map((tx) => tx.id as string);

		await repo.createMany({
			userId: seeded.userId,
			transactions,
		});

		const hidden = await repo.bulkHide({
			userId: seeded.userId,
			transactionIds: ids,
		});
		assert.equal(hidden, 3);

		const remaining = (await seeded.db.transaction.findMany({
			where: { userId: seeded.userId },
			select: { id: true, hidden: true },
		})) as Array<{ id: string; hidden: boolean }>;

		assert.equal(remaining.length, 3);
		assert.deepEqual(
			remaining.map((tx) => tx.hidden),
			[true, true, true],
		);
	});

	it("does not hide rows owned by another user", async () => {
		const seeded = await seed();
		cleanups.push(seeded.close);
		const repo = new SqliteTransactionRepository(seeded.db);
		const owned = row(1);
		await repo.createMany({
			userId: seeded.userId,
			transactions: [owned],
		});

		const hidden = await repo.bulkHide({
			userId: "someone-else",
			transactionIds: [owned.id as string],
		});
		assert.equal(hidden, 0);

		const rowState = (await seeded.db.transaction.findFirst({
			where: { id: owned.id },
			select: { hidden: true },
		})) as { hidden: boolean } | null;
		assert.equal(rowState?.hidden, false);
	});
});
