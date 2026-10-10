/// <reference path="./ambient-modules.d.ts" />
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3-multiple-ciphers";

export const SQLCIPHER_KEY_BYTES = 32;
export const MOAT_SQLITE_USER_VERSION = 1;

export type NativeSqliteDatabase = Database.Database;

export type OpenSqliteOptions = {
	fileMustExist?: boolean;
	nativeBinding?: string;
};

export function resolvePackagedSqlcipherBinding(
	explicit?: string,
): string | undefined {
	if (explicit) return explicit;

	const resourcesPath = (
		process as NodeJS.Process & { resourcesPath?: unknown }
	).resourcesPath;
	if (typeof resourcesPath !== "string" || resourcesPath.length === 0) {
		return undefined;
	}

	const dir = path.join(resourcesPath, "sqlcipher-native");
	const platformArch = `${process.platform}-${process.arch}`;
	const candidates = [
		path.join(dir, `${platformArch}.node`),
		path.join(dir, platformArch, "better_sqlite3.node"),
		path.join(dir, platformArch, "node.napi.node"),
	];
	return candidates.find((candidate) => fs.existsSync(candidate));
}

function assertRawKey(key: Buffer): void {
	if (key.length !== SQLCIPHER_KEY_BYTES) {
		throw new Error("Database key must be 32 bytes");
	}
}

function rawKeyPragma(key: Buffer): string {
	assertRawKey(key);
	return `key = "x'${key.toString("hex")}'"`;
}

function applySqlcipherProfile(db: NativeSqliteDatabase): void {
	db.pragma("cipher = 'sqlcipher'");
	db.pragma("legacy = 4");
}

export function applySqlcipherKey(db: NativeSqliteDatabase, key: Buffer): void {
	applySqlcipherProfile(db);
	db.pragma(rawKeyPragma(key));
}

export function verifySqliteReadable(db: NativeSqliteDatabase): void {
	db.prepare("SELECT count(*) AS c FROM sqlite_master").get();
}

function openDatabase(
	dbPath: string,
	options: OpenSqliteOptions = {},
): NativeSqliteDatabase {
	const nativeBinding = resolvePackagedSqlcipherBinding(options.nativeBinding);
	const db = new Database(dbPath, {
		fileMustExist: options.fileMustExist === true,
		...(nativeBinding ? { nativeBinding } : {}),
	});
	db.defaultSafeIntegers(true);
	return db;
}

export function openPlaintextSqliteConnection(
	dbPath: string,
	options: OpenSqliteOptions = {},
): NativeSqliteDatabase {
	const db = openDatabase(dbPath, options);
	try {
		verifySqliteReadable(db);
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}

export function openEncryptedSqliteConnection(
	dbPath: string,
	key: Buffer,
	options: OpenSqliteOptions = {},
): NativeSqliteDatabase {
	assertRawKey(key);
	const db = openDatabase(dbPath, options);
	try {
		applySqlcipherKey(db, key);
		verifySqliteReadable(db);
		db.pragma("journal_mode = WAL");
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}

export function closeNativeSqlite(db: NativeSqliteDatabase): void {
	if (!db.open) return;
	db.close();
}

function quotePath(filePath: string): string {
	return `'${filePath.replaceAll("'", "''")}'`;
}

function copySchemaObjects(
	source: NativeSqliteDatabase,
	dest: NativeSqliteDatabase,
): void {
	const objects = source
		.prepare(
			`SELECT type, name, sql FROM sqlite_master
			 WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
			 ORDER BY CASE type
			   WHEN 'table' THEN 0
			   WHEN 'index' THEN 1
			   WHEN 'trigger' THEN 2
			   WHEN 'view' THEN 3
			   ELSE 4
			 END, name`,
		)
		.all() as Array<{ type: string; name: string; sql: string }>;

	dest.pragma("foreign_keys = OFF");

	for (const object of objects) {
		dest.exec(object.sql);
	}

	const tables = objects.filter((object) => object.type === "table");
	const insert = dest.transaction((tableName: string) => {
		const rows = source.prepare(`SELECT * FROM "${tableName}"`).all() as Array<
			Record<string, unknown>
		>;
		if (rows.length === 0) return;
		const columns = Object.keys(rows[0] ?? {});
		if (columns.length === 0) return;
		const placeholders = columns.map(() => "?").join(", ");
		const quoted = columns.map((column) => `"${column}"`).join(", ");
		const stmt = dest.prepare(
			`INSERT INTO "${tableName}" (${quoted}) VALUES (${placeholders})`,
		);
		for (const row of rows) {
			stmt.run(...columns.map((column) => row[column]));
		}
	});

	for (const table of tables) {
		insert(table.name);
	}
}

function trySqlcipherExport(
	source: NativeSqliteDatabase,
	destPath: string,
	key: Buffer,
): boolean {
	const hex = key.toString("hex");
	try {
		source.exec(`ATTACH DATABASE ${quotePath(destPath)} AS encrypted`);
		source.pragma("encrypted.cipher = 'sqlcipher'");
		source.pragma("encrypted.legacy = 4");
		source.pragma(`encrypted.key = "x'${hex}'"`);
		source.prepare("SELECT sqlcipher_export('encrypted')").get();
		const userVersion = Number(
			source.pragma("user_version", { simple: true }) ?? 0,
		);
		source.pragma(`encrypted.user_version = ${userVersion}`);
		source.pragma("encrypted.journal_mode = WAL");
		return true;
	} catch {
		return false;
	} finally {
		try {
			source.exec("DETACH DATABASE encrypted");
		} catch {
			// Detach can fail if ATTACH never succeeded.
		}
	}
}

export function exportPlaintextToEncrypted(params: {
	sourcePath: string;
	destPath: string;
	key: Buffer;
	nativeBinding?: string;
}): void {
	assertRawKey(params.key);
	if (fs.existsSync(params.destPath)) {
		fs.unlinkSync(params.destPath);
	}

	const source = openPlaintextSqliteConnection(params.sourcePath, {
		fileMustExist: true,
		nativeBinding: params.nativeBinding,
	});
	try {
		source.pragma("wal_checkpoint(TRUNCATE)");
		const exported = trySqlcipherExport(source, params.destPath, params.key);
		if (exported) {
			const verify = openEncryptedSqliteConnection(
				params.destPath,
				params.key,
				{
					fileMustExist: true,
					nativeBinding: params.nativeBinding,
				},
			);
			closeNativeSqlite(verify);
			return;
		}

		if (fs.existsSync(params.destPath)) {
			fs.unlinkSync(params.destPath);
		}
		const dest = openEncryptedSqliteConnection(params.destPath, params.key, {
			nativeBinding: params.nativeBinding,
		});
		try {
			copySchemaObjects(source, dest);
			const userVersion = Number(
				source.pragma("user_version", { simple: true }) ?? 0,
			);
			dest.pragma(`user_version = ${userVersion}`);
			dest.pragma("journal_mode = WAL");
		} finally {
			closeNativeSqlite(dest);
		}
	} finally {
		closeNativeSqlite(source);
	}
}

export function snapshotSqliteCatalog(db: NativeSqliteDatabase): {
	userVersion: number;
	sqliteMaster: Array<{ name: string; type: string }>;
	rowCounts: Record<string, number>;
	schemaFlags: Record<string, string>;
} {
	const userVersion = Number(db.pragma("user_version", { simple: true }) ?? 0);
	const sqliteMaster = db
		.prepare(
			`SELECT name, type FROM sqlite_master
			 WHERE name NOT LIKE 'sqlite_%'
			 ORDER BY type, name`,
		)
		.all() as Array<{ name: string; type: string }>;

	const rowCounts: Record<string, number> = {};
	const tables = sqliteMaster.filter((entry) => entry.type === "table");
	for (const table of tables) {
		const row = db
			.prepare(`SELECT count(*) AS c FROM "${table.name}"`)
			.get() as { c: number | bigint };
		rowCounts[table.name] = Number(row.c);
	}

	const schemaFlags: Record<string, string> = {};
	const hasFlags = sqliteMaster.some(
		(entry) => entry.type === "table" && entry.name === "_MoatSchemaFlag",
	);
	if (hasFlags) {
		const flags = db
			.prepare(`SELECT "key", "value" FROM "_MoatSchemaFlag"`)
			.all() as Array<{ key: string; value: string }>;
		for (const flag of flags) {
			schemaFlags[flag.key] = flag.value;
		}
	}

	return { userVersion, sqliteMaster, rowCounts, schemaFlags };
}

export function catalogsMatch(
	expected: ReturnType<typeof snapshotSqliteCatalog>,
	actual: ReturnType<typeof snapshotSqliteCatalog>,
): boolean {
	if (expected.userVersion !== actual.userVersion) return false;
	if (expected.sqliteMaster.length !== actual.sqliteMaster.length) return false;
	for (let i = 0; i < expected.sqliteMaster.length; i += 1) {
		const left = expected.sqliteMaster[i];
		const right = actual.sqliteMaster[i];
		if (!left || !right) return false;
		if (left.name !== right.name || left.type !== right.type) return false;
	}
	for (const [table, count] of Object.entries(expected.rowCounts)) {
		if (actual.rowCounts[table] !== count) return false;
	}
	for (const [key, value] of Object.entries(expected.schemaFlags)) {
		if (actual.schemaFlags[key] !== value) return false;
	}
	return true;
}
