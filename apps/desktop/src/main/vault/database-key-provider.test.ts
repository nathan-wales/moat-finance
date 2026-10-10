import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { DatabaseKeyMissingErrorCode } from "../db/database-encryption-error";
import { databaseKeyPath } from "../db/database-paths";
import {
	createDatabaseKeyProvider,
	isPasswordWrappedKeyBlob,
} from "./database-key-provider";
import type { OsCryptoGate } from "./database-key-provider-types";

function tempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "moat-db-key-"));
}

function memoryOsCrypto(options?: {
	platform?: NodeJS.Platform;
	backend?: string | null;
	shouldReEncrypt?: boolean;
}): OsCryptoGate & { store: Map<string, Buffer> } {
	const store = new Map<string, Buffer>();
	return {
		store,
		platform: options?.platform ?? "darwin",
		getLinuxStorageBackend: () => options?.backend ?? null,
		async encryptString(plaintext: string) {
			const encrypted = Buffer.from(plaintext, "utf8");
			store.set(encrypted.toString("hex"), encrypted);
			return {
				encrypted,
				shouldReEncrypt: false,
			};
		},
		async decryptString(encrypted: Buffer) {
			return {
				decrypted: encrypted.toString("utf8"),
				shouldReEncrypt: options?.shouldReEncrypt === true,
				isTemporarilyUnavailable: false,
			};
		},
	};
}

describe("database key provider", () => {
	const dirs: string[] = [];
	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("creates a 32-byte key and reloads it from the persisted blob", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const osCrypto = memoryOsCrypto();
		const provider = createDatabaseKeyProvider(dir, osCrypto);
		const created = await provider.getOrCreateKey({ createIfMissing: true });
		assert.equal(created.length, 32);
		assert.equal(fs.existsSync(databaseKeyPath(dir)), true);
		const mode = fs.statSync(databaseKeyPath(dir)).mode & 0o777;
		if (process.platform !== "win32") {
			assert.equal(mode, 0o600);
		}
		const reloaded = await provider.getOrCreateKey({ createIfMissing: false });
		assert.equal(created.equals(reloaded), true);
	});

	it("does not create a key when createIfMissing is false", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const provider = createDatabaseKeyProvider(dir, memoryOsCrypto());
		await assert.rejects(
			() => provider.getOrCreateKey({ createIfMissing: false }),
			(error: unknown) =>
				error instanceof Error &&
				"code" in error &&
				error.code === DatabaseKeyMissingErrorCode,
		);
	});

	it("rewrites the blob on shouldReEncrypt without changing the key", async () => {
		const dir = tempDir();
		dirs.push(dir);
		const first = memoryOsCrypto();
		const provider = createDatabaseKeyProvider(dir, first);
		const created = await provider.getOrCreateKey({ createIfMissing: true });
		const reencrypt = memoryOsCrypto({ shouldReEncrypt: true });
		const next = createDatabaseKeyProvider(dir, reencrypt);
		const reloaded = await next.getOrCreateKey({ createIfMissing: false });
		assert.equal(created.equals(reloaded), true);
	});

	it("password-wraps on Linux basic_text and never uses OS decrypt", async () => {
		const dir = tempDir();
		dirs.push(dir);
		let osDecryptCalls = 0;
		const osCrypto: OsCryptoGate = {
			platform: "linux",
			getLinuxStorageBackend: () => "basic_text",
			async encryptString() {
				throw new Error("OS encrypt must not be used for basic_text");
			},
			async decryptString() {
				osDecryptCalls += 1;
				return {
					decrypted: "",
					shouldReEncrypt: false,
					isTemporarilyUnavailable: false,
				};
			},
		};
		const provider = createDatabaseKeyProvider(dir, osCrypto);
		assert.equal(provider.keyStorage(), "insecure_os_backend");
		const created = await provider.getOrCreateKey({
			createIfMissing: true,
			vaultPassword: "correct-horse-battery",
		});
		const reloaded = await provider.getOrCreateKey({
			createIfMissing: false,
			vaultPassword: "correct-horse-battery",
		});
		assert.equal(created.equals(reloaded), true);
		assert.equal(osDecryptCalls, 0);
		assert.equal(isPasswordWrappedKeyBlob(dir), true);
		await assert.rejects(() =>
			provider.getOrCreateKey({
				createIfMissing: false,
				vaultPassword: "wrong-password",
			}),
		);
	});
});
