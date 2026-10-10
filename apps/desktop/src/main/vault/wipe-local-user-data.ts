import fs from "node:fs";
import path from "node:path";
import { LEGACY_USER_DATA_FOLDER_NAMES } from "../user-data-name";

/**
 * Chromium/Electron entries that must stay while the process is running.
 * Everything else under userData is Moat data and is deleted on vault reset.
 */
export const ELECTRON_RUNTIME_USER_DATA_NAMES = new Set([
	"Cache",
	"CachedData",
	"Code Cache",
	"Crash Reports",
	"Crashpad",
	"Cookies",
	"Cookies-journal",
	"DIPS",
	"DIPS-shm",
	"DIPS-wal",
	"DawnGraphiteCache",
	"DawnWebGPUCache",
	"DevToolsActivePort",
	"File System",
	"GPUCache",
	"GrShaderCache",
	"IndexedDB",
	"LOCK",
	"Local Extension Settings",
	"Local State",
	"Local Storage",
	"Network",
	"Network Persistent State",
	"Partitions",
	"Preferences",
	"QuotaManager",
	"QuotaManager-journal",
	"Secure Preferences",
	"Service Worker",
	"Session Storage",
	"ShaderCache",
	"Shared Dictionary",
	"SharedStorage",
	"SingletonCookie",
	"SingletonLock",
	"SingletonSocket",
	"TransportSecurity",
	"Trust Tokens",
	"Trust Tokens-journal",
	"VideoDecodeStats",
	"WebStorage",
	"blob_storage",
	"databases",
	"lockfile",
	"logs",
	"webrtc_event_logs",
]);

export function wipeLocalUserData(userDataPath: string): void {
	if (!fs.existsSync(userDataPath)) return;

	const entries = fs.readdirSync(userDataPath, { withFileTypes: true });
	for (const entry of entries) {
		if (ELECTRON_RUNTIME_USER_DATA_NAMES.has(entry.name)) continue;
		fs.rmSync(path.join(userDataPath, entry.name), {
			force: true,
			recursive: true,
		});
	}
}

export function wipeLegacySiblingUserData(options: {
	appDataPath: string;
	currentUserDataPath: string;
	legacyFolderNames?: readonly string[];
}): void {
	const folderNames =
		options.legacyFolderNames ?? LEGACY_USER_DATA_FOLDER_NAMES;
	for (const folder of folderNames) {
		const legacyPath = path.join(options.appDataPath, folder);
		if (
			path.resolve(legacyPath) === path.resolve(options.currentUserDataPath)
		) {
			continue;
		}
		fs.rmSync(legacyPath, { force: true, recursive: true });
	}
}
