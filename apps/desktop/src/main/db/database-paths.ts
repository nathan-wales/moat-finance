import fs from "node:fs";
import path from "node:path";

export const PRODUCTION_DB_FILENAME = "moat.db";
export const FORMAT_SIDECAR_FILENAME = "moat-db-format.json";
export const SAFETY_COPY_SUFFIX = ".safety-copy";
export const ENCRYPTED_MIGRATION_SUFFIX = ".encrypted-migration";
export const LEGACY_PLAINTEXT_SUFFIX = ".legacy-plaintext";
export const MIGRATION_STATE_FILENAME = "encryption-migration-state.json";
export const DATABASE_KEY_FILENAME = "database-key.bin";
export const SQLITE_SIDECAR_SUFFIXES = ["-wal", "-shm"] as const;
export const DESKTOP_DB_FORMAT_MIN_APP_VERSION = "0.1.33";

export type DbFormatSidecar = {
	version: 1;
	encryption: "sqlcipher";
	minAppVersion: string;
};

export function productionDbPath(userDataPath: string): string {
	return path.join(userDataPath, PRODUCTION_DB_FILENAME);
}

export function formatSidecarPath(userDataPath: string): string {
	return path.join(userDataPath, FORMAT_SIDECAR_FILENAME);
}

export function databaseKeyPath(userDataPath: string): string {
	return path.join(userDataPath, "vault", DATABASE_KEY_FILENAME);
}

export function migrationStatePath(userDataPath: string): string {
	return path.join(userDataPath, "vault", MIGRATION_STATE_FILENAME);
}

export function siblingPath(dbPath: string, suffix: string): string {
	return `${dbPath}${suffix}`;
}

export function sqliteFamily(dbPath: string): string[] {
	return [
		dbPath,
		...SQLITE_SIDECAR_SUFFIXES.map((suffix) => `${dbPath}${suffix}`),
	];
}

export function unlinkIfExists(filePath: string): void {
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}
}

export function unlinkSqliteFamily(dbPath: string): void {
	for (const filePath of sqliteFamily(dbPath)) {
		unlinkIfExists(filePath);
	}
}

export function copySqliteFamily(
	sourceDbPath: string,
	destDbPath: string,
): void {
	for (const suffix of ["", ...SQLITE_SIDECAR_SUFFIXES]) {
		const source = `${sourceDbPath}${suffix}`;
		const dest = `${destDbPath}${suffix}`;
		if (!fs.existsSync(source)) continue;
		fs.copyFileSync(source, dest);
	}
}

export function renameSqliteFamily(
	sourceDbPath: string,
	destDbPath: string,
): void {
	for (const suffix of ["", ...SQLITE_SIDECAR_SUFFIXES]) {
		const source = `${sourceDbPath}${suffix}`;
		const dest = `${destDbPath}${suffix}`;
		if (!fs.existsSync(source)) continue;
		if (fs.existsSync(dest)) {
			fs.unlinkSync(dest);
		}
		fs.renameSync(source, dest);
	}
}

export function readFormatSidecar(
	userDataPath: string,
): DbFormatSidecar | null {
	const filePath = formatSidecarPath(userDataPath);
	if (!fs.existsSync(filePath)) return null;
	try {
		const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			(parsed as { version?: unknown }).version !== 1 ||
			(parsed as { encryption?: unknown }).encryption !== "sqlcipher" ||
			typeof (parsed as { minAppVersion?: unknown }).minAppVersion !== "string"
		) {
			return null;
		}
		return parsed as DbFormatSidecar;
	} catch {
		return null;
	}
}

export function writeFormatSidecar(
	userDataPath: string,
	minAppVersion: string = DESKTOP_DB_FORMAT_MIN_APP_VERSION,
): void {
	const sidecar: DbFormatSidecar = {
		version: 1,
		encryption: "sqlcipher",
		minAppVersion,
	};
	const filePath = formatSidecarPath(userDataPath);
	const tmp = `${filePath}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(sidecar, null, 2), "utf-8");
	fs.renameSync(tmp, filePath);
}

export function encryptionArtifactsExist(userDataPath: string): boolean {
	const dbPath = productionDbPath(userDataPath);
	return (
		fs.existsSync(dbPath) ||
		fs.existsSync(siblingPath(dbPath, SAFETY_COPY_SUFFIX)) ||
		fs.existsSync(siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX)) ||
		fs.existsSync(siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX))
	);
}

export function compareAppVersions(left: string, right: string): number {
	const leftParts = left
		.split(".")
		.map((part) => Number.parseInt(part, 10) || 0);
	const rightParts = right
		.split(".")
		.map((part) => Number.parseInt(part, 10) || 0);
	const length = Math.max(leftParts.length, rightParts.length);
	for (let i = 0; i < length; i += 1) {
		const a = leftParts[i] ?? 0;
		const b = rightParts[i] ?? 0;
		if (a > b) return 1;
		if (a < b) return -1;
	}
	return 0;
}

export function deleteEncryptionArtifacts(
	userDataPath: string,
	options: { includeProductionDb: boolean },
): void {
	const dbPath = productionDbPath(userDataPath);
	if (options.includeProductionDb) {
		unlinkSqliteFamily(dbPath);
	}
	unlinkSqliteFamily(siblingPath(dbPath, SAFETY_COPY_SUFFIX));
	unlinkSqliteFamily(siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX));
	unlinkSqliteFamily(siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX));
	unlinkIfExists(formatSidecarPath(userDataPath));
	unlinkIfExists(databaseKeyPath(userDataPath));
	unlinkIfExists(migrationStatePath(userDataPath));
}
