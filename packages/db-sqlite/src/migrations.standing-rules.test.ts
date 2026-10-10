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

describe("runMigrations standing rules", () => {
	it("adds RetirementStandingRule and plan policy columns to an existing plan table", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlite-"));
		const dbPath = path.join(dir, "moat.db");
		const handle = createSqliteClientHandle(dbPath, { key: testKey() });
		const db = handle.client;

		try {
			await db.$executeRaw`
				CREATE TABLE "RetirementPlan" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"userId" TEXT NOT NULL UNIQUE,
					"targetRetirementAge" INTEGER NOT NULL DEFAULT 65,
					"longevityAge" INTEGER NOT NULL DEFAULT 95,
					"socialSecurityClaimAge" INTEGER NOT NULL DEFAULT 67,
					"hasSpouse" INTEGER NOT NULL DEFAULT 0,
					"confidenceTarget" REAL NOT NULL DEFAULT 0.85,
					"monteCarloTrials" INTEGER NOT NULL DEFAULT 1000,
					"spendingStages" TEXT NOT NULL DEFAULT '[]',
					"spendingOverrides" TEXT NOT NULL DEFAULT '{}',
					"timelinePreferences" TEXT NOT NULL DEFAULT '{}',
					"withdrawalOrder" TEXT NOT NULL DEFAULT '["taxable","taxDeferred","taxFree"]',
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
				)
			`;

			await runMigrations(db);

			const tables = await db.$queryRaw<Array<{ name: string }>>`
				SELECT name FROM sqlite_master
				WHERE type = 'table' AND name = 'RetirementStandingRule'
			`;
			assert.equal(tables.length, 1);

			const cols = (
				await db.$queryRaw<Array<{ name: string }>>`
					PRAGMA table_info("RetirementPlan")
				`
			).map((row) => row.name);
			assert.ok(cols.includes("contributionPolicy"));
			assert.ok(cols.includes("spendingPolicy"));
			assert.ok(cols.includes("healthcarePolicy"));
			assert.ok(cols.includes("taxPolicy"));
			assert.ok(cols.includes("cashPolicy"));
			assert.ok(cols.includes("allocationPolicy"));
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
