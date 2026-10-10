import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
	LEGACY_USER_DATA_FOLDER_NAMES,
	UNPACKAGED_USER_DATA_NAME,
} from "./user-data-name";

const LEGACY_DB_FILENAME = "fin.db";
const CURRENT_DB_FILENAME = "moat.db";

function copyFileIfMissing(source: string, destination: string): void {
	if (!fs.existsSync(source) || fs.existsSync(destination)) return;
	fs.mkdirSync(path.dirname(destination), { recursive: true });
	fs.copyFileSync(source, destination);
}

function copyTreeIfMissing(sourceDir: string, destinationDir: string): void {
	if (!fs.existsSync(sourceDir)) return;
	fs.mkdirSync(destinationDir, { recursive: true });

	for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
		const sourcePath = path.join(sourceDir, entry.name);
		const destinationPath = path.join(destinationDir, entry.name);

		if (entry.isDirectory()) {
			copyTreeIfMissing(sourcePath, destinationPath);
			continue;
		}

		if (!entry.isFile()) continue;
		copyFileIfMissing(sourcePath, destinationPath);
	}
}

function migrateLegacyDbAliases(userDataPath: string): void {
	const legacyDbPath = path.join(userDataPath, LEGACY_DB_FILENAME);
	const currentDbPath = path.join(userDataPath, CURRENT_DB_FILENAME);

	copyFileIfMissing(legacyDbPath, currentDbPath);
	copyFileIfMissing(`${legacyDbPath}-wal`, `${currentDbPath}-wal`);
	copyFileIfMissing(`${legacyDbPath}-shm`, `${currentDbPath}-shm`);
}

/**
 * One-time migration for installs that used older userData folder names
 * (`moat-desktop`, `Moat Finance`) or the legacy `fin.db` filename.
 * Copies missing files/dirs into the current user-data directory.
 *
 * Unpackaged (`moat-finance-dev`) must not inherit packaged `moat-finance`
 * data — those Plaid tokens are encrypted with a different safeStorage key.
 */
export function migrateLegacyDesktopData(userDataPath: string): void {
	const appData = app.getPath("appData");
	const unpackagedUserDataPath = path.join(appData, UNPACKAGED_USER_DATA_NAME);
	if (userDataPath === unpackagedUserDataPath) {
		migrateLegacyDbAliases(userDataPath);
		return;
	}

	for (const folder of LEGACY_USER_DATA_FOLDER_NAMES) {
		const legacyUserDataPath = path.join(appData, folder);
		if (legacyUserDataPath === userDataPath) continue;
		copyTreeIfMissing(legacyUserDataPath, userDataPath);
	}

	migrateLegacyDbAliases(userDataPath);
}
