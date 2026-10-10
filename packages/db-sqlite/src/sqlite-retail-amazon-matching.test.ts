import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createSqliteClientHandle } from "./createSqliteClient";
import { runMigrations, seedLocalUser } from "./migrations";
import { SqliteRetailRepository } from "./repositories/SqliteRetailRepository";

function testKey(): Buffer {
	return Buffer.from("a".repeat(64), "hex");
}

describe("sqlite amazon retail matching stamp", () => {
	it("sets amazonRetailEnrichedAt on the linked transaction and does not create extra rows", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlite-"));
		const dbPath = path.join(dir, "moat.db");
		const handle = createSqliteClientHandle(dbPath, { key: testKey() });
		const db = handle.client;

		try {
			await runMigrations(db);
			await seedLocalUser(db);

			const userId = "local-user";
			const transactionId = randomUUID();
			const orderId = randomUUID();
			const itemId = randomUUID();
			const now = new Date();

			await db.transaction.create({
				data: {
					id: transactionId,
					userId,
					date: new Date("2026-08-02T12:00:00.000Z"),
					amount: -42.5,
					type: "EXPENSE",
					description: "AMAZON MKTPLACE PMTS",
					hidden: false,
					pending: false,
					source: "PLAID",
					createdAt: now,
					updatedAt: now,
				},
			});

			await db.retailOrder.create({
				data: {
					id: orderId,
					userId,
					retailer: "amazon",
					externalOrderId: "111-222",
					orderDate: new Date("2026-08-01T12:00:00.000Z"),
					total: 42.5,
					sourceUrl: "https://www.amazon.com/gp/css/order-history",
					scrapedAt: now,
					parserVersion: "test",
					createdAt: now,
					updatedAt: now,
				},
			});

			await db.retailOrderItem.create({
				data: {
					id: itemId,
					retailOrderId: orderId,
					title: "USB cable",
					matchStatus: "unmatched",
					createdAt: now,
					updatedAt: now,
				},
			});

			const retail = new SqliteRetailRepository(db);
			const result = await retail.runAmazonMatching({ userId });
			assert.equal(result.linkedItems, 1);

			const stamped = (await db.transaction.findUnique({
				where: { id: transactionId },
				select: { amazonRetailEnrichedAt: true },
			})) as { amazonRetailEnrichedAt: Date | string | null } | null;
			assert.ok(stamped?.amazonRetailEnrichedAt);

			const count = await db.transaction.count({ where: { userId } });
			assert.equal(count, 1);
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("backfills amazonRetailEnrichedAt from already-linked retail items", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlite-"));
		const dbPath = path.join(dir, "moat.db");
		const handle = createSqliteClientHandle(dbPath, { key: testKey() });
		const db = handle.client;

		try {
			await runMigrations(db);
			await seedLocalUser(db);

			const userId = "local-user";
			const transactionId = randomUUID();
			const orderId = randomUUID();
			const matchedAt = new Date("2026-08-10T00:00:00.000Z");
			const now = new Date();

			await db.transaction.create({
				data: {
					id: transactionId,
					userId,
					date: new Date("2026-08-02T12:00:00.000Z"),
					amount: -12,
					type: "EXPENSE",
					description: "Amazon.com",
					hidden: false,
					pending: false,
					source: "PLAID",
					createdAt: now,
					updatedAt: now,
				},
			});

			await db.retailOrder.create({
				data: {
					id: orderId,
					userId,
					retailer: "amazon",
					externalOrderId: "333-444",
					orderDate: new Date("2026-08-01T12:00:00.000Z"),
					total: 12,
					sourceUrl: "https://www.amazon.com/gp/css/order-history",
					scrapedAt: now,
					parserVersion: "test",
					createdAt: now,
					updatedAt: now,
				},
			});

			await db.retailOrderItem.create({
				data: {
					id: randomUUID(),
					retailOrderId: orderId,
					transactionId,
					title: "Notebook",
					matchStatus: "linked",
					matchedAt,
					createdAt: now,
					updatedAt: now,
				},
			});

			await runMigrations(db);

			const stamped = (await db.transaction.findUnique({
				where: { id: transactionId },
				select: { amazonRetailEnrichedAt: true },
			})) as { amazonRetailEnrichedAt: Date | string | null } | null;
			assert.ok(stamped?.amazonRetailEnrichedAt);
			const enrichedAt = stamped.amazonRetailEnrichedAt;
			assert.equal(new Date(enrichedAt).toISOString(), matchedAt.toISOString());
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
