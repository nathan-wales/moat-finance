import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
	createTaxFileStorage,
	readTaxR2Config,
	type TaxR2ObjectStore,
} from "./taxes-file-storage";

const R2_ENV = {
	TAX_R2_ACCOUNT_ID: "account-id",
	TAX_R2_ACCESS_KEY_ID: "access-key",
	TAX_R2_SECRET_ACCESS_KEY: "secret-key",
	TAX_R2_BUCKET: "moat-tax-files",
};

const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const tempRoots: string[] = [];

afterEach(async () => {
	if (ORIGINAL_ENCRYPTION_KEY === undefined) {
		delete process.env.ENCRYPTION_KEY;
	} else {
		process.env.ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
	}
	await Promise.all(
		tempRoots
			.splice(0)
			.map((root) => rm(root, { recursive: true, force: true })),
	);
});

function env(
	overrides: Record<string, string | undefined>,
): Record<string, string | undefined> {
	return { ...overrides };
}

describe("readTaxR2Config", () => {
	it("returns null when any TAX_R2 var is missing", () => {
		assert.equal(readTaxR2Config(env({ ...R2_ENV, TAX_R2_BUCKET: "" })), null);
		assert.equal(readTaxR2Config(env({})), null);
	});

	it("returns the config when all TAX_R2 vars are set", () => {
		assert.deepEqual(readTaxR2Config(env(R2_ENV)), {
			accountId: "account-id",
			accessKeyId: "access-key",
			secretAccessKey: "secret-key",
			bucket: "moat-tax-files",
		});
	});
});

describe("createTaxFileStorage", () => {
	it("uses R2 when TAX_R2 vars are set", async () => {
		const files = new Map<string, { bytes: Uint8Array; mimeType: string }>();
		const store: TaxR2ObjectStore = {
			async putObject(input) {
				files.set(input.key, {
					bytes: input.bytes,
					mimeType: input.mimeType,
				});
			},
			async getObject(key) {
				const file = files.get(key);
				if (!file) throw new Error("missing");
				return file;
			},
			async deleteObject(key) {
				files.delete(key);
			},
		};
		let created = false;
		process.env.ENCRYPTION_KEY =
			"0000000000000000000000000000000000000000000000000000000000000000";
		const storage = createTaxFileStorage(
			env({
				...R2_ENV,
				NODE_ENV: "production",
				ENCRYPTION_KEY:
					"0000000000000000000000000000000000000000000000000000000000000000",
			}),
			{
				createR2Client: () => {
					created = true;
					return store;
				},
			},
		);

		assert.equal(created, true);
		await storage.put({
			key: "taxes/user/2026/doc/original",
			bytes: new Uint8Array([1, 2, 3]),
			mimeType: "application/pdf",
			visibility: "private",
		});
		const stored = await storage.get("taxes/user/2026/doc/original");
		assert.equal(stored.mimeType, "application/pdf");
		assert.deepEqual([...stored.bytes], [1, 2, 3]);
		const raw = files.get("taxes/user/2026/doc/original");
		assert.ok(raw);
		assert.notDeepEqual([...raw.bytes], [1, 2, 3]);
	});

	it("throws in production when encryption is missing", () => {
		const store: TaxR2ObjectStore = {
			async putObject() {},
			async getObject() {
				throw new Error("missing");
			},
			async deleteObject() {},
		};
		assert.throws(
			() =>
				createTaxFileStorage(
					env({ ...R2_ENV, NODE_ENV: "production", ENCRYPTION_KEY: "" }),
					{ createR2Client: () => store },
				),
			/Tax file encryption is not configured/,
		);
	});

	it("throws in production when TAX_R2 vars are missing", () => {
		assert.throws(
			() => createTaxFileStorage(env({ NODE_ENV: "production" })),
			/Tax file storage is not configured/,
		);
	});

	it("uses the local directory fallback outside production", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "moat-tax-files-"));
		tempRoots.push(root);
		const storage = createTaxFileStorage(
			env({ NODE_ENV: "development", TAX_FILE_STORAGE_DIR: root }),
		);
		const key = "taxes/user/2026/doc/original";
		await storage.put({
			key,
			bytes: new Uint8Array([9, 8, 7]),
			mimeType: "image/png",
			visibility: "private",
		});
		const stored = await storage.get(key);
		assert.equal(stored.mimeType, "image/png");
		assert.deepEqual([...stored.bytes], [9, 8, 7]);
		const mimeOnDisk = await readFile(path.join(root, `${key}.mime`), "utf8");
		assert.equal(mimeOnDisk, "image/png");
	});
});
