import fs from "node:fs";
import {
	compareAppVersions,
	formatSidecarPath,
	productionDbPath,
	readFormatSidecar,
} from "./database-paths";

const SQLITE_HEADER = Buffer.from("SQLite format 3\0");

export type DetectedDatabaseFormat =
	| { kind: "missing" }
	| { kind: "plaintext" }
	| { kind: "encrypted" }
	| { kind: "incompatible"; minAppVersion: string };

function readHeader(dbPath: string): Buffer | null {
	if (!fs.existsSync(dbPath)) return null;
	const fd = fs.openSync(dbPath, "r");
	try {
		const buf = Buffer.alloc(16);
		const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
		return buf.subarray(0, bytesRead);
	} catch {
		return null;
	} finally {
		fs.closeSync(fd);
	}
}

export function isPlaintextSqliteFile(dbPath: string): boolean {
	const header = readHeader(dbPath);
	if (!header || header.length < 16) return false;
	return header.equals(SQLITE_HEADER);
}

export function detectDatabaseFormat(
	userDataPath: string,
	appVersion: string,
): DetectedDatabaseFormat {
	const dbPath = productionDbPath(userDataPath);
	const sidecar = readFormatSidecar(userDataPath);
	if (sidecar && compareAppVersions(sidecar.minAppVersion, appVersion) > 0) {
		return { kind: "incompatible", minAppVersion: sidecar.minAppVersion };
	}

	if (!fs.existsSync(dbPath)) {
		return { kind: "missing" };
	}

	if (isPlaintextSqliteFile(dbPath)) {
		return { kind: "plaintext" };
	}

	return { kind: "encrypted" };
}

export function formatSidecarExists(userDataPath: string): boolean {
	return fs.existsSync(formatSidecarPath(userDataPath));
}
