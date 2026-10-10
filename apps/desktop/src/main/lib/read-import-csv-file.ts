import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { MAX_CSV_TEXT_CHARS, TransactionImportError } from "@moat/domain";

export async function readCsvFromFilePath(filePath: string): Promise<string> {
	if (!path.isAbsolute(filePath)) {
		throw new TransactionImportError(
			"INVALID_FILE_PATH",
			"filePath must be an absolute path",
		);
	}
	if (path.extname(filePath).toLowerCase() !== ".csv") {
		throw new TransactionImportError(
			"INVALID_FILE_PATH",
			"filePath must end with .csv",
		);
	}

	let fileStat: Awaited<ReturnType<typeof stat>>;
	try {
		fileStat = await stat(filePath);
	} catch {
		throw new TransactionImportError("FILE_NOT_FOUND", "CSV file not found");
	}

	if (!fileStat.isFile()) {
		throw new TransactionImportError(
			"INVALID_FILE_PATH",
			"filePath is not a file",
		);
	}
	if (fileStat.size > MAX_CSV_TEXT_CHARS) {
		throw new TransactionImportError(
			"PAYLOAD_TOO_LARGE",
			"CSV text exceeds the 2,000,000 character limit",
		);
	}

	const csvText = await readFile(filePath, "utf8");
	if (csvText.length > MAX_CSV_TEXT_CHARS) {
		throw new TransactionImportError(
			"PAYLOAD_TOO_LARGE",
			"CSV text exceeds the 2,000,000 character limit",
		);
	}
	return csvText;
}
