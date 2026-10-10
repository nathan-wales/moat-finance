import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createSqliteClientHandle } from "./createSqliteClient";
import { runMigrations, seedLocalUser } from "./migrations";
import {
	createLocalChildProfile,
	listLocalProfiles,
	updateLocalProfile,
} from "./profiles";

function testKey(): Buffer {
	return Buffer.from("a".repeat(64), "hex");
}

describe("local profile business type", () => {
	it("adds ProfileLink.businessType on existing tables", async () => {
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
				CREATE TABLE "ProfileLink" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"ownerUserId" TEXT NOT NULL,
					"profileUserId" TEXT NOT NULL,
					"kind" TEXT NOT NULL,
					"displayName" TEXT NOT NULL,
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"archivedAt" DATETIME
				)
			`;

			await runMigrations(db);

			const cols = (
				await db.$queryRaw<Array<{ name: string }>>`
					PRAGMA table_info("ProfileLink")
				`
			).map((row) => row.name);
			assert.ok(cols.includes("businessType"));
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("requires a business type when creating a business profile", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlite-"));
		const dbPath = path.join(dir, "moat.db");
		const handle = createSqliteClientHandle(dbPath, { key: testKey() });
		const db = handle.client;

		try {
			await runMigrations(db);
			await seedLocalUser(db);

			await assert.rejects(
				() =>
					createLocalChildProfile(db, {
						kind: "BUSINESS",
						displayName: "Acme",
					}),
				/Business type is required/,
			);

			const created = await createLocalChildProfile(db, {
				kind: "BUSINESS",
				displayName: "Acme",
				businessType: "SINGLE_MEMBER_LLC",
			});
			assert.equal(created.businessType, "SINGLE_MEMBER_LLC");

			const updated = await updateLocalProfile(db, {
				id: created.id,
				businessType: "S_CORPORATION",
			});
			assert.equal(updated.businessType, "S_CORPORATION");

			const listed = await listLocalProfiles(db);
			const active = listed.find((profile) => profile.id === created.id);
			assert.equal(active?.businessType, "S_CORPORATION");
		} finally {
			await handle.close();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
