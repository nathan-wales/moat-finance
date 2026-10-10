import fs from "node:fs";
import path from "node:path";

/**
 * Ensures the directory for the local SQLite database exists.
 * Creates any missing parent directories.
 *
 * @param dbPath - Absolute path to moat.db (e.g. ~/Library/Application Support/Moat Finance/moat.db)
 */
export function ensureLocalDatabase(dbPath: string): void {
	const dir = path.dirname(dbPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}
