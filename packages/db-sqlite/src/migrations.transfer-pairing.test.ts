import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createSqliteClientHandle } from "./createSqliteClient";
import { runMigrations, seedDefaultCategories } from "./migrations";

function testKey(): Buffer {
	return Buffer.from("a".repeat(64), "hex");
}

describe("runMigrations transfer pairing", () => {
	it("adds transfer pair columns and seeds Transfer as hidden", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlite-"));
		const dbPath = path.join(dir, "moat.db");
		const handle = createSqliteClientHandle(dbPath, { key: testKey() });
		const db = handle.client;

		try {
			await db.$executeRaw`
				CREATE TABLE "Transaction" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"userId" TEXT NOT NULL,
					"date" DATETIME NOT NULL,
					"amount" REAL NOT NULL,
					"type" TEXT NOT NULL DEFAULT 'EXPENSE',
					"pending" INTEGER NOT NULL DEFAULT 0,
					"hidden" INTEGER NOT NULL DEFAULT 0,
					"source" TEXT NOT NULL DEFAULT 'manual',
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
				)
			`;

			await runMigrations(db);
			await seedDefaultCategories(db);

			const txCols = (
				await db.$queryRaw<Array<{ name: string }>>`
					PRAGMA table_info("Transaction")
				`
			).map((row) => row.name);
			assert.ok(txCols.includes("transferPairId"));
			assert.ok(txCols.includes("autoHiddenAsTransfer"));

			const transfer = await db.$queryRaw<
				Array<{ isHidden: number | boolean }>
			>`
				SELECT "isHidden" FROM "Category"
				WHERE "userId" IS NULL AND "name" = 'Transfer'
				LIMIT 1
			`;
			assert.equal(Boolean(transfer[0]?.isHidden), true);
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
