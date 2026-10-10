import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { writeFormatSidecar } from "./database-paths";
import { detectDatabaseFormat } from "./detect-database-format";

function tempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "moat-db-format-"));
}

describe("detectDatabaseFormat", () => {
	const dirs: string[] = [];
	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reports missing when no database file exists", () => {
		const dir = tempDir();
		dirs.push(dir);
		assert.equal(detectDatabaseFormat(dir, "0.1.34").kind, "missing");
	});

	it("detects plaintext sqlite headers", () => {
		const dir = tempDir();
		dirs.push(dir);
		const header = Buffer.concat([
			Buffer.from("SQLite format 3\0"),
			Buffer.alloc(16),
		]);
		fs.writeFileSync(path.join(dir, "moat.db"), header);
		assert.equal(detectDatabaseFormat(dir, "0.1.34").kind, "plaintext");
	});

	it("treats non-sqlite bytes as encrypted", () => {
		const dir = tempDir();
		dirs.push(dir);
		fs.writeFileSync(path.join(dir, "moat.db"), Buffer.alloc(32, 7));
		assert.equal(detectDatabaseFormat(dir, "0.1.34").kind, "encrypted");
	});

	it("fails closed when the sidecar requires a newer app", () => {
		const dir = tempDir();
		dirs.push(dir);
		fs.writeFileSync(path.join(dir, "moat.db"), Buffer.alloc(32, 7));
		writeFormatSidecar(dir, "9.0.0");
		const format = detectDatabaseFormat(dir, "0.1.34");
		assert.equal(format.kind, "incompatible");
		if (format.kind === "incompatible") {
			assert.equal(format.minAppVersion, "9.0.0");
		}
	});
});
