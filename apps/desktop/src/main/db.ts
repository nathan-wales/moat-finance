import fs from "node:fs";
import path from "node:path";
import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	createSqliteAppContext,
	createSqliteClientHandle,
	ensureLocalDatabase,
	purgeLegacyDesktopDemoWorkspaces,
	reprocessUncategorizedPlaidCategories,
	resolveActiveProfileUserId,
	resolvePackagedSqlcipherBinding,
	runMigrations,
	type SqliteClientHandle,
	seedDefaultCategories,
	seedLocalUser,
} from "@moat/db-sqlite";
import type { AppRuntime } from "@moat/runtime";
import { createRuntime } from "@moat/runtime";
import { app } from "electron";
import { ensureEncryptedDesktopDatabase } from "./db/database-encryption-migration";
import { readFormatSidecar, writeFormatSidecar } from "./db/database-paths";
import { migrateLegacyDesktopData } from "./migrate-legacy-data";
import { createDatabaseKeyProvider } from "./vault/database-key-provider";
import {
	decryptOsStringAsync,
	encryptOsStringAsync,
	getLinuxStorageBackend,
} from "./vault/os-safe-storage";

export type DesktopDb = {
	db: SqliteDbClient;
	appCtx: AppRuntime;
	dbPath: string;
};

let _desktop: DesktopDb | null = null;
let _handle: SqliteClientHandle | null = null;

function setRuntimeUserId(runtime: AppRuntime, userId: string): void {
	(runtime as { userId: string }).userId = userId;
}

export type InitDesktopDbOptions = {
	vaultPassword?: string;
	allowCreate?: boolean;
};

export async function initDesktopDb(
	userDataPath: string,
	options: InitDesktopDbOptions = {},
): Promise<DesktopDb> {
	migrateLegacyDesktopData(userDataPath);

	const dbPath = path.join(userDataPath, "moat.db");
	ensureLocalDatabase(dbPath);

	const keyProvider = createDatabaseKeyProvider(userDataPath, {
		encryptString: encryptOsStringAsync,
		decryptString: decryptOsStringAsync,
		getLinuxStorageBackend,
		platform: process.platform,
	});
	const { key } = await ensureEncryptedDesktopDatabase({
		userDataPath,
		keyProvider,
		vaultPassword: options.vaultPassword,
		allowCreate: options.allowCreate === true,
		appVersion: app.getVersion(),
		nativeBinding: resolvePackagedSqlcipherBinding(),
	});

	const handle = createSqliteClientHandle(dbPath, {
		key,
		nativeBinding: resolvePackagedSqlcipherBinding(),
		fileMustExist: fs.existsSync(dbPath),
	});
	const db = handle.client;

	await runMigrations(db);
	await seedLocalUser(db);
	await seedDefaultCategories(db);
	await reprocessUncategorizedPlaidCategories(db);

	try {
		const purge = await purgeLegacyDesktopDemoWorkspaces(db);
		if (purge.purgedUserCount > 0) {
			console.log("[db] purged legacy desktop demo workspaces", purge);
		}
	} catch (err) {
		console.error("[db] purgeLegacyDesktopDemoWorkspaces failed", err);
	}

	const activeUserId = await resolveActiveProfileUserId(db);
	const appCtx = createRuntime(createSqliteAppContext(db, activeUserId));

	_handle = handle;
	_desktop = { db, appCtx, dbPath };
	writeFormatSidecar(
		userDataPath,
		readFormatSidecar(userDataPath)?.minAppVersion ?? app.getVersion(),
	);
	return _desktop;
}

export function getDesktopDb(): DesktopDb {
	if (!_desktop) {
		throw new Error(
			"Desktop DB has not been initialized. Call initDesktopDb() first.",
		);
	}
	return _desktop;
}

export async function closeDesktopDb(): Promise<void> {
	if (_handle) {
		try {
			await _handle.close();
		} catch (error) {
			console.error("[db] Failed to close local database", error);
		}
	}
	_handle = null;
	_desktop = null;
}

export function setDesktopActiveUserId(userId: string): void {
	const desktop = getDesktopDb();
	setRuntimeUserId(desktop.appCtx, userId);
}
