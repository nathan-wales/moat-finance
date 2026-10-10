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

describe("runMigrations plaid holdings", () => {
	it("adds PlaidHolding and PlaidItem capability columns", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlite-"));
		const dbPath = path.join(dir, "moat.db");
		const handle = createSqliteClientHandle(dbPath, { key: testKey() });
		const db = handle.client;

		try {
			await db.$executeRaw`
				CREATE TABLE "LocalUser" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
				)
			`;
			await db.$executeRaw`
				CREATE TABLE "PlaidItem" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"plaidItemId" TEXT NOT NULL UNIQUE,
					"userId" TEXT NOT NULL,
					"institutionId" TEXT,
					"institutionName" TEXT NOT NULL,
					"accessTokenEncrypted" BLOB,
					"accessRevokedAt" DATETIME,
					"cursor" TEXT,
					"requiresReconnect" INTEGER NOT NULL DEFAULT 0,
					"lastErrorCode" TEXT,
					"lastErrorMessage" TEXT,
					"lastSyncAt" DATETIME,
					"lastSuccessfulSyncAt" DATETIME,
					"sortOrder" INTEGER NOT NULL DEFAULT 0,
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
				)
			`;
			await db.$executeRaw`
				CREATE TABLE "PlaidAccount" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"plaidAccountId" TEXT NOT NULL UNIQUE,
					"plaidItemId" TEXT NOT NULL,
					"name" TEXT NOT NULL,
					"officialName" TEXT,
					"mask" TEXT,
					"type" TEXT NOT NULL,
					"subtype" TEXT,
					"currentBalance" REAL,
					"availableBalance" REAL,
					"currency" TEXT NOT NULL DEFAULT 'USD',
					"isActive" INTEGER NOT NULL DEFAULT 1,
					"isHidden" INTEGER NOT NULL DEFAULT 0,
					"lastBalanceSyncAt" DATETIME,
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
				)
			`;

			await runMigrations(db);

			const itemCols = (
				await db.$queryRaw<Array<{ name: string }>>`
					PRAGMA table_info("PlaidItem")
				`
			).map((row) => row.name);
			assert.ok(itemCols.includes("billedProductsJson"));
			assert.ok(itemCols.includes("availableProductsJson"));
			assert.ok(itemCols.includes("consentedProductsJson"));
			assert.ok(itemCols.includes("lastHoldingsSyncAt"));

			const tables = await db.$queryRaw<Array<{ name: string }>>`
				SELECT name FROM sqlite_master
				WHERE type = 'table' AND name = 'PlaidHolding'
			`;
			assert.equal(tables.length, 1);
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
