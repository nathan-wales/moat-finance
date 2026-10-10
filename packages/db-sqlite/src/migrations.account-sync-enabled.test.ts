import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createSqliteClientHandle } from "./createSqliteClient";
import { runMigrations } from "./migrations";

function testKey(): Buffer {
	return Buffer.from("a".repeat(64), "hex");
}

describe("runMigrations account syncEnabled", () => {
	it("adds PlaidAccount.syncEnabled with default on", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlite-"));
		const dbPath = path.join(dir, "moat.db");
		const handle = createSqliteClientHandle(dbPath, { key: testKey() });
		const db = handle.client;

		try {
			await db.$executeRaw`
				CREATE TABLE "PlaidAccount" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"plaidAccountId" TEXT NOT NULL UNIQUE,
					"plaidItemId" TEXT NOT NULL,
					"name" TEXT NOT NULL,
					"type" TEXT NOT NULL,
					"currency" TEXT NOT NULL DEFAULT 'USD',
					"isActive" INTEGER NOT NULL DEFAULT 1,
					"isHidden" INTEGER NOT NULL DEFAULT 0,
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
				)
			`;
			await db.$executeRaw`
				INSERT INTO "PlaidAccount"
					("id", "plaidAccountId", "plaidItemId", "name", "type")
				VALUES
					('acct-1', 'plaid-acct-1', 'item-1', 'Checking', 'depository')
			`;

			await runMigrations(db);

			const cols = (
				await db.$queryRaw<Array<{ name: string }>>`
					PRAGMA table_info("PlaidAccount")
				`
			).map((row) => row.name);
			assert.ok(cols.includes("syncEnabled"));

			const rows = await db.$queryRaw<Array<{ syncEnabled: number }>>`
				SELECT "syncEnabled" FROM "PlaidAccount" WHERE "id" = 'acct-1'
			`;
			assert.equal(rows[0]?.syncEnabled, 1);
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
