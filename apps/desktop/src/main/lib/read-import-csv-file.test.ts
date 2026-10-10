import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { MAX_CSV_TEXT_CHARS, TransactionImportError } from "@moat/domain";
import { readCsvFromFilePath } from "./read-import-csv-file";

describe("readCsvFromFilePath", () => {
	it("reads an absolute csv file", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "moat-import-"));
		const filePath = path.join(dir, "statement.csv");
		await writeFile(filePath, "Date,Amount\n2026-08-01,12.50\n");
		const csvText = await readCsvFromFilePath(filePath);
		assert.match(csvText, /Date,Amount/);
	});

	it("rejects a relative path", async () => {
		await assert.rejects(
			() => readCsvFromFilePath("statement.csv"),
			(error: unknown) =>
				error instanceof TransactionImportError &&
				error.code === "INVALID_FILE_PATH",
		);
	});

	it("rejects a missing file", async () => {
		await assert.rejects(
			() => readCsvFromFilePath(path.join(tmpdir(), "missing-import.csv")),
			(error: unknown) =>
				error instanceof TransactionImportError &&
				error.code === "FILE_NOT_FOUND",
		);
	});

	it("rejects a file over the csv size cap", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "moat-import-"));
		const filePath = path.join(dir, "huge.csv");
		await writeFile(filePath, "x".repeat(MAX_CSV_TEXT_CHARS + 1));
		await assert.rejects(
			() => readCsvFromFilePath(filePath),
			(error: unknown) =>
				error instanceof TransactionImportError &&
				error.code === "PAYLOAD_TOO_LARGE",
		);
	});
});
