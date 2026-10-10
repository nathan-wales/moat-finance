import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
	exportPlaintextToEncrypted,
	openEncryptedSqliteConnection,
	openPlaintextSqliteConnection,
	snapshotSqliteCatalog,
} from "@moat/db-sqlite";
import { createDatabaseKeyProvider } from "../vault/database-key-provider";
import type { OsCryptoGate } from "../vault/database-key-provider-types";
import {
	DatabaseFileMissingErrorCode,
	DatabaseKeyMissingErrorCode,
} from "./database-encryption-error";
import {
	ensureEncryptedDesktopDatabase,
	recoverInterruptedEncryptionMigration,
} from "./database-encryption-migration";
import {
	deleteEncryptionArtifacts,
	ENCRYPTED_MIGRATION_SUFFIX,
	LEGACY_PLAINTEXT_SUFFIX,
	productionDbPath,
	SAFETY_COPY_SUFFIX,
	siblingPath,
	writeFormatSidecar,
} from "./database-paths";
import { migratePlaintextDatabase } from "./encrypt-legacy-database";

function tempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "moat-db-migrate-"));
}

function seedPlaintext(dbPath: string): void {
	const db = openPlaintextSqliteConnection(dbPath);
	try {
		db.exec(`
			CREATE TABLE "Account" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL);
			CREATE TABLE "_MoatSchemaFlag" ("key" TEXT PRIMARY KEY, "value" TEXT NOT NULL);
		`);
		db.prepare(`INSERT INTO "Account" VALUES (?, ?)`).run("1", "Checking");
		db.prepare(`INSERT INTO "_MoatSchemaFlag" VALUES (?, ?)`).run("flag", "1");
	} finally {
		db.close();
	}
}

function memoryOsCrypto(): OsCryptoGate {
	return {
		platform: "darwin",
		getLinuxStorageBackend: () => null,
		async encryptString(plaintext: string) {
			return {
				encrypted: Buffer.from(plaintext, "utf8"),
				shouldReEncrypt: false,
			};
		},
		async decryptString(encrypted: Buffer) {
			return {
				decrypted: encrypted.toString("utf8"),
				shouldReEncrypt: false,
				isTemporarilyUnavailable: false,
			};
		},
	};
}

describe("encryption migration recovery", () => {
	const dirs: string[] = [];
	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("migrates plaintext and is idempotent on a second run", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		seedPlaintext(dbPath);
		const source = openPlaintextSqliteConnection(dbPath, {
			fileMustExist: true,
		});
		const expected = snapshotSqliteCatalog(source);
		source.close();

		const provider = createDatabaseKeyProvider(dir, memoryOsCrypto());
		const first = await ensureEncryptedDesktopDatabase({
			userDataPath: dir,
			keyProvider: provider,
			allowCreate: false,
			appVersion: "0.1.34",
		});
		assert.equal(fs.existsSync(dbPath), true);
		assert.equal(
			fs.existsSync(siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX)),
			false,
		);
		assert.equal(
			fs.existsSync(siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX)),
			false,
		);

		const encrypted = openEncryptedSqliteConnection(dbPath, first.key, {
			fileMustExist: true,
		});
		try {
			assert.equal(snapshotSqliteCatalog(encrypted).rowCounts.Account, 1);
			assert.deepEqual(expected.rowCounts.Account, 1);
		} finally {
			encrypted.close();
		}

		const second = await ensureEncryptedDesktopDatabase({
			userDataPath: dir,
			keyProvider: provider,
			allowCreate: false,
			appVersion: "0.1.34",
		});
		assert.equal(first.key.equals(second.key), true);
		assert.equal(fs.existsSync(dbPath), true);
	});

	it("deletes an incomplete encrypted candidate and keeps plaintext production", () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		seedPlaintext(dbPath);
		fs.writeFileSync(
			siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX),
			"partial",
		);
		recoverInterruptedEncryptionMigration({
			userDataPath: dir,
			key: null,
			appVersion: "0.1.34",
		});
		assert.equal(
			fs.existsSync(siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX)),
			false,
		);
		assert.equal(fs.existsSync(dbPath), true);
		const db = openPlaintextSqliteConnection(dbPath, { fileMustExist: true });
		try {
			assert.equal(snapshotSqliteCatalog(db).rowCounts.Account, 1);
		} finally {
			db.close();
		}
	});

	it("leaves legacy plus candidate in place until a key is available", () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		const legacyPath = siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX);
		seedPlaintext(legacyPath);
		fs.writeFileSync(
			siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX),
			"partial",
		);
		recoverInterruptedEncryptionMigration({
			userDataPath: dir,
			key: null,
			appVersion: "0.1.34",
		});
		assert.equal(fs.existsSync(dbPath), false);
		assert.equal(fs.existsSync(legacyPath), true);
		assert.equal(
			fs.existsSync(siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX)),
			true,
		);
	});

	it("promotes a validated encrypted candidate after an interrupted swap", () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		const legacyPath = siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX);
		const candidatePath = siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX);
		seedPlaintext(legacyPath);
		const key = randomBytes(32);
		exportPlaintextToEncrypted({
			sourcePath: legacyPath,
			destPath: candidatePath,
			key,
		});
		recoverInterruptedEncryptionMigration({
			userDataPath: dir,
			key,
			appVersion: "0.1.34",
		});
		assert.equal(fs.existsSync(dbPath), true);
		const encrypted = openEncryptedSqliteConnection(dbPath, key, {
			fileMustExist: true,
		});
		try {
			assert.equal(snapshotSqliteCatalog(encrypted).rowCounts.Account, 1);
		} finally {
			encrypted.close();
		}
	});

	it("restores plaintext when the encrypted candidate cannot be validated", () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		const legacyPath = siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX);
		seedPlaintext(legacyPath);
		fs.writeFileSync(
			siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX),
			"corrupt",
		);
		recoverInterruptedEncryptionMigration({
			userDataPath: dir,
			key: randomBytes(32),
			appVersion: "0.1.34",
		});
		assert.equal(fs.existsSync(dbPath), true);
		const db = openPlaintextSqliteConnection(dbPath, { fileMustExist: true });
		try {
			assert.equal(snapshotSqliteCatalog(db).rowCounts.Account, 1);
		} finally {
			db.close();
		}
	});

	it("does not create a new key when an encrypted file has no blob", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		fs.writeFileSync(dbPath, Buffer.alloc(32, 7));
		const provider = createDatabaseKeyProvider(dir, memoryOsCrypto());
		await assert.rejects(
			() =>
				ensureEncryptedDesktopDatabase({
					userDataPath: dir,
					keyProvider: provider,
					allowCreate: true,
					appVersion: "0.1.34",
				}),
			(error: unknown) =>
				error instanceof Error &&
				"code" in error &&
				error.code === DatabaseKeyMissingErrorCode,
		);
		assert.equal(provider.hasBlob(), false);
		assert.equal(fs.existsSync(dbPath), true);
	});

	it("does not create an empty database when the file is missing on unlock", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const provider = createDatabaseKeyProvider(dir, memoryOsCrypto());
		await assert.rejects(
			() =>
				ensureEncryptedDesktopDatabase({
					userDataPath: dir,
					keyProvider: provider,
					allowCreate: false,
					appVersion: "0.1.34",
				}),
			(error: unknown) =>
				error instanceof Error &&
				"code" in error &&
				error.code === DatabaseFileMissingErrorCode,
		);
		assert.equal(fs.existsSync(productionDbPath(dir)), false);
		assert.equal(provider.hasBlob(), false);
	});

	it("leaves plaintext in place when export validation cannot reopen the candidate", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		seedPlaintext(dbPath);
		const key = randomBytes(32);
		await assert.rejects(() =>
			migratePlaintextDatabase({
				userDataPath: dir,
				dbPath,
				key,
				appVersion: "0.1.34",
				reloadKey: async () => randomBytes(32),
			}),
		);
		assert.equal(fs.existsSync(dbPath), true);
		assert.equal(
			fs.existsSync(siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX)),
			false,
		);
		const db = openPlaintextSqliteConnection(dbPath, { fileMustExist: true });
		try {
			assert.equal(snapshotSqliteCatalog(db).rowCounts.Account, 1);
		} finally {
			db.close();
		}
	});

	it("restores a missing production database from the safety copy", () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		const safetyPath = siblingPath(dbPath, SAFETY_COPY_SUFFIX);
		seedPlaintext(safetyPath);
		recoverInterruptedEncryptionMigration({
			userDataPath: dir,
			key: null,
			appVersion: "0.1.34",
		});
		assert.equal(fs.existsSync(dbPath), true);
		const db = openPlaintextSqliteConnection(dbPath, { fileMustExist: true });
		try {
			assert.equal(snapshotSqliteCatalog(db).rowCounts.Account, 1);
		} finally {
			db.close();
		}
	});

	it("does not delete leftover plaintext when encrypted production fails catalog checks", () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		const legacyPath = siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX);
		seedPlaintext(legacyPath);
		const key = randomBytes(32);
		const emptyPlain = `${dbPath}.empty-src`;
		const emptyDb = openPlaintextSqliteConnection(emptyPlain);
		try {
			emptyDb.exec(
				`CREATE TABLE "Account" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL);`,
			);
		} finally {
			emptyDb.close();
		}
		exportPlaintextToEncrypted({
			sourcePath: emptyPlain,
			destPath: dbPath,
			key,
		});
		recoverInterruptedEncryptionMigration({
			userDataPath: dir,
			key,
			appVersion: "0.1.34",
		});
		assert.equal(fs.existsSync(dbPath), true);
		const restored = openPlaintextSqliteConnection(dbPath, {
			fileMustExist: true,
		});
		try {
			assert.equal(snapshotSqliteCatalog(restored).rowCounts.Account, 1);
		} finally {
			restored.close();
		}
	});

	it("removes leftover plaintext copies after a successful encrypted reopen", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		seedPlaintext(dbPath);
		const provider = createDatabaseKeyProvider(dir, memoryOsCrypto());
		const migrated = await ensureEncryptedDesktopDatabase({
			userDataPath: dir,
			keyProvider: provider,
			allowCreate: false,
			appVersion: "0.1.34",
		});
		fs.writeFileSync(siblingPath(dbPath, SAFETY_COPY_SUFFIX), "leftover");
		const again = await ensureEncryptedDesktopDatabase({
			userDataPath: dir,
			keyProvider: provider,
			allowCreate: false,
			appVersion: "0.1.34",
		});
		assert.equal(migrated.key.equals(again.key), true);
		assert.equal(fs.existsSync(siblingPath(dbPath, SAFETY_COPY_SUFFIX)), false);
		assert.equal(
			fs.existsSync(siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX)),
			false,
		);
	});

	it("restores swap leftovers and re-encrypts when the key blob is missing", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		const legacyPath = siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX);
		seedPlaintext(legacyPath);
		fs.writeFileSync(
			siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX),
			"partial",
		);
		const provider = createDatabaseKeyProvider(dir, memoryOsCrypto());
		const result = await ensureEncryptedDesktopDatabase({
			userDataPath: dir,
			keyProvider: provider,
			allowCreate: false,
			appVersion: "0.1.34",
		});
		assert.equal(fs.existsSync(dbPath), true);
		assert.equal(provider.hasBlob(), true);
		const encrypted = openEncryptedSqliteConnection(dbPath, result.key, {
			fileMustExist: true,
		});
		try {
			assert.equal(snapshotSqliteCatalog(encrypted).rowCounts.Account, 1);
		} finally {
			encrypted.close();
		}
	});

	it("reset deletes the production db, key blob, and temp files", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const dbPath = productionDbPath(dir);
		seedPlaintext(dbPath);
		fs.writeFileSync(siblingPath(dbPath, SAFETY_COPY_SUFFIX), "safety");
		writeFormatSidecar(dir, "0.1.34");
		const provider = createDatabaseKeyProvider(dir, memoryOsCrypto());
		await provider.getOrCreateKey({ createIfMissing: true });
		deleteEncryptionArtifacts(dir, { includeProductionDb: true });
		assert.equal(fs.existsSync(dbPath), false);
		assert.equal(provider.hasBlob(), false);
		assert.equal(fs.existsSync(siblingPath(dbPath, SAFETY_COPY_SUFFIX)), false);
	});
});
