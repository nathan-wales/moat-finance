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

describe("runMigrations original description backfill", () => {
	it("copies original_description and location from stored Plaid raw JSON", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlite-"));
		const dbPath = path.join(dir, "moat.db");
		const handle = createSqliteClientHandle(dbPath, { key: testKey() });
		const db = handle.client;

		try {
			await runMigrations(db);
			await db.localUser.create({ data: { id: "local-user" } });

			const raw = JSON.stringify({
				original_description: "TICKET OFFICE WEB UT",
				location: {
					address: "123 Main St",
					city: "Orem",
					region: "UT",
					postal_code: "84058",
					country: "US",
					lat: 40.27,
					lon: -111.72,
					store_number: null,
				},
			});

			await db.$executeRaw`
				INSERT INTO "Transaction" (
					"id", "userId", "date", "amount", "type", "description",
					"originalDescription", "location", "raw", "source",
					"pending", "hidden", "createdAt", "updatedAt"
				)
				VALUES (
					'tx-backfill-1',
					'local-user',
					'2026-09-01T00:00:00.000Z',
					12.34,
					'EXPENSE',
					'TICKET OFFICE',
					NULL,
					NULL,
					${raw},
					'PLAID',
					0,
					0,
					CURRENT_TIMESTAMP,
					CURRENT_TIMESTAMP
				)
			`;

			await runMigrations(db);

			const rows = await db.$queryRaw<
				Array<{ originalDescription: string | null; location: string | null }>
			>`
				SELECT "originalDescription", "location"
				FROM "Transaction"
				WHERE "id" = 'tx-backfill-1'
			`;
			assert.equal(rows[0]?.originalDescription, "TICKET OFFICE WEB UT");
			const storedLocation = rows[0]?.location;
			assert.ok(storedLocation);
			const parsedLocation =
				typeof storedLocation === "string"
					? (JSON.parse(storedLocation) as Record<string, unknown>)
					: storedLocation;
			assert.deepEqual(parsedLocation, {
				address: "123 Main St",
				city: "Orem",
				region: "UT",
				postal_code: "84058",
				country: "US",
				lat: 40.27,
				lon: -111.72,
				store_number: null,
			});
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
