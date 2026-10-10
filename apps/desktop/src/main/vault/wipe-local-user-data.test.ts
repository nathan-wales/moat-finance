import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
	wipeLegacySiblingUserData,
	wipeLocalUserData,
} from "./wipe-local-user-data";

const dirs: string[] = [];

function tempDir(prefix: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

function writeFile(dir: string, name: string, contents = "x"): string {
	const filePath = path.join(dir, name);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents);
	return filePath;
}

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("wipeLocalUserData", () => {
	it("deletes vault, database, agent, and other Moat files", () => {
		const userData = tempDir("moat-wipe-");
		writeFile(userData, "moat.db");
		writeFile(userData, "moat.db-wal");
		writeFile(userData, "moat.db-shm");
		writeFile(userData, "fin.db");
		writeFile(userData, "moat-db-format.json");
		writeFile(userData, path.join("vault", "vault-config.json"));
		writeFile(userData, path.join("vault", "database-key.bin"));
		writeFile(userData, "agent-audit.jsonl", '{"tool":"moat.getNetWorth"}\n');
		writeFile(userData, "agent-tokens.json", "[]");
		writeFile(userData, "agent-settings.json", "{}");
		writeFile(userData, "retail-ingest-sessions.json", "{}");
		writeFile(userData, "cloud-token.bin");
		writeFile(userData, "cloud-backup-state.json", "{}");

		wipeLocalUserData(userData);

		assert.equal(fs.existsSync(path.join(userData, "moat.db")), false);
		assert.equal(fs.existsSync(path.join(userData, "moat.db-wal")), false);
		assert.equal(
			fs.existsSync(path.join(userData, "agent-audit.jsonl")),
			false,
		);
		assert.equal(
			fs.existsSync(path.join(userData, "agent-tokens.json")),
			false,
		);
		assert.equal(
			fs.existsSync(path.join(userData, "agent-settings.json")),
			false,
		);
		assert.equal(
			fs.existsSync(path.join(userData, "retail-ingest-sessions.json")),
			false,
		);
		assert.equal(fs.existsSync(path.join(userData, "cloud-token.bin")), false);
		assert.equal(
			fs.existsSync(path.join(userData, "cloud-backup-state.json")),
			false,
		);
		assert.equal(fs.existsSync(path.join(userData, "vault")), false);
		assert.equal(fs.existsSync(path.join(userData, "fin.db")), false);
	});

	it("deletes unknown sidecar files so new local data cannot survive reset", () => {
		const userData = tempDir("moat-wipe-unknown-");
		writeFile(userData, "future-feature.json", "{}");
		writeFile(userData, path.join("import-cache", "file.csv"));

		wipeLocalUserData(userData);

		assert.equal(
			fs.existsSync(path.join(userData, "future-feature.json")),
			false,
		);
		assert.equal(fs.existsSync(path.join(userData, "import-cache")), false);
	});

	it("keeps Electron runtime entries so a running app can continue", () => {
		const userData = tempDir("moat-wipe-runtime-");
		writeFile(userData, "SingletonLock");
		writeFile(userData, path.join("Cache", "data"));
		writeFile(userData, path.join("Local Storage", "leveldb", "000003.log"));
		writeFile(userData, "agent-audit.jsonl");

		wipeLocalUserData(userData);

		assert.equal(fs.existsSync(path.join(userData, "SingletonLock")), true);
		assert.equal(fs.existsSync(path.join(userData, "Cache", "data")), true);
		assert.equal(
			fs.existsSync(
				path.join(userData, "Local Storage", "leveldb", "000003.log"),
			),
			true,
		);
		assert.equal(
			fs.existsSync(path.join(userData, "agent-audit.jsonl")),
			false,
		);
	});

	it("is a no-op when the directory does not exist", () => {
		assert.doesNotThrow(() => {
			wipeLocalUserData(
				path.join(os.tmpdir(), "moat-wipe-missing-does-not-exist"),
			);
		});
	});
});

describe("wipeLegacySiblingUserData", () => {
	it("deletes leftover legacy userData folders that would be copied back on setup", () => {
		const appData = tempDir("moat-appdata-");
		const current = path.join(appData, "moat-finance");
		const legacyDesktop = path.join(appData, "moat-desktop");
		const legacyFinance = path.join(appData, "Moat Finance");
		fs.mkdirSync(current, { recursive: true });
		writeFile(legacyDesktop, "moat.db");
		writeFile(legacyFinance, "agent-audit.jsonl");

		wipeLegacySiblingUserData({
			appDataPath: appData,
			currentUserDataPath: current,
		});

		assert.equal(fs.existsSync(legacyDesktop), false);
		assert.equal(fs.existsSync(legacyFinance), false);
		assert.equal(fs.existsSync(current), true);
	});

	it("does not delete the current userData folder when it uses a legacy name", () => {
		const appData = tempDir("moat-appdata-current-");
		const current = path.join(appData, "moat-desktop");
		writeFile(current, "moat.db");

		wipeLegacySiblingUserData({
			appDataPath: appData,
			currentUserDataPath: current,
		});

		assert.equal(fs.existsSync(path.join(current, "moat.db")), true);
	});
});
