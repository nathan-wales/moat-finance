import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, it } from "node:test";
import { createSqliteClientHandle } from "./createSqliteClient";
import {
	exportPlaintextToEncrypted,
	openEncryptedSqliteConnection,
	openPlaintextSqliteConnection,
	snapshotSqliteCatalog,
} from "./encrypted-sqlite-connection";
import { runMigrations } from "./migrations";

const PLANTED_MERCHANT = "ACME_PLANTED_MERCHANT_ZX9";
const PLANTED_AMOUNT = "12345.67";

function tempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "moat-sqlcipher-"));
}

function cleanup(dir: string): void {
	fs.rmSync(dir, { recursive: true, force: true });
}

function assertOrdinarySqliteCannotOpen(dbPath: string): void {
	assert.throws(() => {
		const db = new DatabaseSync(dbPath);
		try {
			db.prepare("SELECT count(*) FROM sqlite_master").get();
		} finally {
			db.close();
		}
	});
}

function rawBytesContain(dbPath: string, needle: string): boolean {
	const bytes = fs.readFileSync(dbPath);
	return bytes.includes(Buffer.from(needle, "utf8"));
}

describe("encrypted sqlite connection", () => {
	const dirs: string[] = [];
	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			cleanup(dir);
		}
	});

	it("creates an encrypted database that stock sqlite cannot read", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = path.join(dir, "moat.db");
		const key = randomBytes(32);
		const handle = createSqliteClientHandle(dbPath, { key });
		try {
			await runMigrations(handle.client);
			await handle.client.$executeRaw`
				INSERT INTO "LocalUser" ("id", "createdAt", "updatedAt")
				VALUES ('local-user', ${new Date().toISOString()}, ${new Date().toISOString()})
			`;
		} finally {
			await handle.close();
		}

		assertOrdinarySqliteCannotOpen(dbPath);
		assert.equal(rawBytesContain(dbPath, "SQLite format 3"), false);
		assert.equal(rawBytesContain(dbPath, "LocalUser"), false);

		const wrongKey = randomBytes(32);
		assert.throws(() =>
			openEncryptedSqliteConnection(dbPath, wrongKey, {
				fileMustExist: true,
			}),
		);

		const reopened = openEncryptedSqliteConnection(dbPath, key, {
			fileMustExist: true,
		});
		try {
			const row = reopened
				.prepare(`SELECT count(*) AS c FROM "LocalUser"`)
				.get() as { c: number | bigint };
			assert.equal(Number(row.c), 1);
			reopened
				.prepare(
					`INSERT INTO "LocalUser" ("id", "createdAt", "updatedAt") VALUES (?, ?, ?)`,
				)
				.run("wal-user", new Date().toISOString(), new Date().toISOString());
		} finally {
			reopened.close();
		}

		const walPath = `${dbPath}-wal`;
		if (fs.existsSync(walPath) && fs.statSync(walPath).size > 0) {
			assert.equal(rawBytesContain(walPath, "wal-user"), false);
			assert.equal(rawBytesContain(walPath, "SQLite format 3"), false);
		}
	});

	it("commits Prisma transactions on the keyed adapter", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = path.join(dir, "moat.db");
		const key = randomBytes(32);
		const handle = createSqliteClientHandle(dbPath, { key });
		try {
			await runMigrations(handle.client);
			await handle.client.$transaction(async (tx) => {
				await tx.$executeRaw`
					INSERT INTO "LocalUser" ("id", "createdAt", "updatedAt")
					VALUES ('tx-user', ${new Date().toISOString()}, ${new Date().toISOString()})
				`;
			});
		} finally {
			await handle.close();
		}

		const reopened = openEncryptedSqliteConnection(dbPath, key, {
			fileMustExist: true,
		});
		try {
			const row = reopened
				.prepare(`SELECT count(*) AS c FROM "LocalUser" WHERE "id" = 'tx-user'`)
				.get() as { c: number | bigint };
			assert.equal(Number(row.c), 1);
		} finally {
			reopened.close();
		}
	});

	it("completes an upsert inside an interactive transaction", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = path.join(dir, "moat.db");
		const key = randomBytes(32);
		const handle = createSqliteClientHandle(dbPath, { key });
		try {
			await runMigrations(handle.client);
			const upsertPromise = handle.client.$transaction(async (tx) => {
				await tx.localUser.upsert({
					where: { id: "upsert-user" },
					create: { id: "upsert-user" },
					update: {},
				});
			});
			const raced = await Promise.race([
				upsertPromise.then(() => "ok" as const),
				new Promise<"timeout">((resolve) => {
					setTimeout(() => resolve("timeout"), 4000);
				}),
			]);
			assert.equal(raced, "ok");
		} finally {
			await handle.close();
		}
	});

	it("migrates a WAL plaintext database without losing rows or flags", () => {
		const dir = tempDir();
		dirs.push(dir);
		const sourcePath = path.join(dir, "moat.db");
		const destPath = path.join(dir, "moat.db.encrypted-migration");
		const key = randomBytes(32);

		const plaintext = openPlaintextSqliteConnection(sourcePath);
		try {
			plaintext.pragma("journal_mode = WAL");
			plaintext.exec(`
				CREATE TABLE "Account" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"name" TEXT NOT NULL,
					"amount" REAL NOT NULL
				);
				CREATE TABLE "_MoatSchemaFlag" (
					"key" TEXT NOT NULL PRIMARY KEY,
					"value" TEXT NOT NULL
				);
				CREATE INDEX "Account_name_idx" ON "Account" ("name");
			`);
			plaintext
				.prepare(
					`INSERT INTO "Account" ("id", "name", "amount") VALUES (?, ?, ?)`,
				)
				.run("acct_1", PLANTED_MERCHANT, Number(PLANTED_AMOUNT));
			plaintext
				.prepare(`INSERT INTO "_MoatSchemaFlag" ("key", "value") VALUES (?, ?)`)
				.run("investment_accrual_safe_backfill_v1", "1");
			plaintext.pragma("user_version = 7");
			plaintext.pragma("wal_checkpoint(TRUNCATE)");
		} finally {
			plaintext.close();
		}

		assert.equal(rawBytesContain(sourcePath, PLANTED_MERCHANT), true);

		const expected = (() => {
			const db = openPlaintextSqliteConnection(sourcePath, {
				fileMustExist: true,
			});
			try {
				return snapshotSqliteCatalog(db);
			} finally {
				db.close();
			}
		})();

		exportPlaintextToEncrypted({ sourcePath, destPath, key });

		assertOrdinarySqliteCannotOpen(destPath);
		assert.equal(rawBytesContain(destPath, PLANTED_MERCHANT), false);
		assert.equal(rawBytesContain(destPath, PLANTED_AMOUNT), false);
		assert.equal(rawBytesContain(destPath, "SQLite format 3"), false);

		const encrypted = openEncryptedSqliteConnection(destPath, key, {
			fileMustExist: true,
		});
		try {
			const actual = snapshotSqliteCatalog(encrypted);
			assert.equal(actual.userVersion, 7);
			assert.equal(actual.rowCounts.Account, 1);
			assert.equal(actual.schemaFlags.investment_accrual_safe_backfill_v1, "1");
			assert.ok(
				actual.sqliteMaster.some(
					(entry) =>
						entry.type === "index" && entry.name === "Account_name_idx",
				),
			);
			assert.deepEqual(expected.rowCounts, actual.rowCounts);
			const row = encrypted
				.prepare(`SELECT "name", "amount" FROM "Account"`)
				.get() as { name: string; amount: number };
			assert.equal(row.name, PLANTED_MERCHANT);
			assert.equal(row.amount, Number(PLANTED_AMOUNT));
		} finally {
			encrypted.close();
		}

		const walPath = `${destPath}-wal`;
		if (fs.existsSync(walPath) && fs.statSync(walPath).size > 0) {
			assert.equal(rawBytesContain(walPath, PLANTED_MERCHANT), false);
			assert.equal(rawBytesContain(walPath, "SQLite format 3"), false);
		}
	});

	it("copies child tables that sort before their parents under foreign keys", () => {
		const dir = tempDir();
		dirs.push(dir);
		const sourcePath = path.join(dir, "moat.db");
		const destPath = path.join(dir, "moat.db.encrypted-migration");
		const key = randomBytes(32);

		const plaintext = openPlaintextSqliteConnection(sourcePath);
		try {
			plaintext.exec(`
				CREATE TABLE "LocalUser" (
					"id" TEXT NOT NULL PRIMARY KEY
				);
				CREATE TABLE "AccountBalanceHistory" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"userId" TEXT NOT NULL,
					FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
				);
			`);
			plaintext.prepare(`INSERT INTO "LocalUser" ("id") VALUES (?)`).run("user_1");
			plaintext
				.prepare(
					`INSERT INTO "AccountBalanceHistory" ("id", "userId") VALUES (?, ?)`,
				)
				.run("hist_1", "user_1");
		} finally {
			plaintext.close();
		}

		exportPlaintextToEncrypted({ sourcePath, destPath, key });

		const encrypted = openEncryptedSqliteConnection(destPath, key, {
			fileMustExist: true,
		});
		try {
			const actual = snapshotSqliteCatalog(encrypted);
			assert.equal(actual.rowCounts.LocalUser, 1);
			assert.equal(actual.rowCounts.AccountBalanceHistory, 1);
		} finally {
			encrypted.close();
		}
	});

	it("rejects a missing key buffer length", () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = path.join(dir, "moat.db");
		assert.throws(() =>
			openEncryptedSqliteConnection(dbPath, Buffer.alloc(16)),
		);
	});
});
