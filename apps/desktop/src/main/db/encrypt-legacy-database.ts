import fs from "node:fs";
import path from "node:path";
import {
	closeNativeSqlite,
	exportPlaintextToEncrypted,
	openEncryptedSqliteConnection,
	openPlaintextSqliteConnection,
	snapshotSqliteCatalog,
} from "@moat/db-sqlite";
import {
	DatabaseEncryptionError,
	EncryptionMigrationFailedErrorCode,
} from "./database-encryption-error";
import { validateEncryptedCandidate } from "./database-encryption-validation";
import {
	copySqliteFamily,
	ENCRYPTED_MIGRATION_SUFFIX,
	LEGACY_PLAINTEXT_SUFFIX,
	migrationStatePath,
	renameSqliteFamily,
	SAFETY_COPY_SUFFIX,
	siblingPath,
	unlinkSqliteFamily,
	writeFormatSidecar,
} from "./database-paths";

export type EncryptionMigrationState = {
	phase:
		| "prepare"
		| "safety-copy"
		| "export"
		| "validate"
		| "cutover"
		| "cleanup"
		| "complete";
	userVersion: number;
	sqliteMaster: Array<{ name: string; type: string }>;
	rowCounts: Record<string, number>;
	schemaFlags: Record<string, string>;
};

function writeState(
	userDataPath: string,
	state: EncryptionMigrationState,
): void {
	const filePath = migrationStatePath(userDataPath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

function checkpointPlaintext(dbPath: string, nativeBinding?: string): void {
	const db = openPlaintextSqliteConnection(dbPath, {
		fileMustExist: true,
		nativeBinding,
	});
	try {
		db.pragma("wal_checkpoint(TRUNCATE)");
	} finally {
		closeNativeSqlite(db);
	}
}

export async function migratePlaintextDatabase(params: {
	userDataPath: string;
	dbPath: string;
	key: Buffer;
	appVersion: string;
	nativeBinding?: string;
	reloadKey: () => Promise<Buffer>;
}): Promise<void> {
	const { dbPath, key, nativeBinding } = params;
	const safetyPath = siblingPath(dbPath, SAFETY_COPY_SUFFIX);
	const candidatePath = siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX);
	const legacyPath = siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX);

	try {
		checkpointPlaintext(dbPath, nativeBinding);

		const source = openPlaintextSqliteConnection(dbPath, {
			fileMustExist: true,
			nativeBinding,
		});
		let expected: ReturnType<typeof snapshotSqliteCatalog>;
		try {
			expected = snapshotSqliteCatalog(source);
		} finally {
			closeNativeSqlite(source);
		}

		writeState(params.userDataPath, {
			phase: "prepare",
			userVersion: expected.userVersion,
			sqliteMaster: expected.sqliteMaster,
			rowCounts: expected.rowCounts,
			schemaFlags: expected.schemaFlags,
		});

		copySqliteFamily(dbPath, safetyPath);
		writeState(params.userDataPath, {
			phase: "safety-copy",
			userVersion: expected.userVersion,
			sqliteMaster: expected.sqliteMaster,
			rowCounts: expected.rowCounts,
			schemaFlags: expected.schemaFlags,
		});

		unlinkSqliteFamily(candidatePath);
		exportPlaintextToEncrypted({
			sourcePath: dbPath,
			destPath: candidatePath,
			key,
			nativeBinding,
		});
		writeState(params.userDataPath, {
			phase: "export",
			userVersion: expected.userVersion,
			sqliteMaster: expected.sqliteMaster,
			rowCounts: expected.rowCounts,
			schemaFlags: expected.schemaFlags,
		});

		validateEncryptedCandidate({
			dbPath: candidatePath,
			key,
			expected,
			nativeBinding,
		});
		const persistedKey = await params.reloadKey();
		validateEncryptedCandidate({
			dbPath: candidatePath,
			key: persistedKey,
			expected,
			nativeBinding,
		});
		writeState(params.userDataPath, {
			phase: "validate",
			userVersion: expected.userVersion,
			sqliteMaster: expected.sqliteMaster,
			rowCounts: expected.rowCounts,
			schemaFlags: expected.schemaFlags,
		});

		renameSqliteFamily(dbPath, legacyPath);
		try {
			renameSqliteFamily(candidatePath, dbPath);
		} catch (error) {
			if (fs.existsSync(legacyPath) && !fs.existsSync(dbPath)) {
				renameSqliteFamily(legacyPath, dbPath);
			}
			throw error;
		}
		writeFormatSidecar(params.userDataPath, params.appVersion);
		writeState(params.userDataPath, {
			phase: "cutover",
			userVersion: expected.userVersion,
			sqliteMaster: expected.sqliteMaster,
			rowCounts: expected.rowCounts,
			schemaFlags: expected.schemaFlags,
		});

		validateEncryptedCandidate({
			dbPath,
			key: persistedKey,
			expected,
			nativeBinding,
		});

		unlinkSqliteFamily(legacyPath);
		unlinkSqliteFamily(safetyPath);
		unlinkSqliteFamily(candidatePath);
		writeState(params.userDataPath, {
			phase: "complete",
			userVersion: expected.userVersion,
			sqliteMaster: expected.sqliteMaster,
			rowCounts: expected.rowCounts,
			schemaFlags: expected.schemaFlags,
		});
	} catch (error) {
		unlinkSqliteFamily(candidatePath);
		if (fs.existsSync(legacyPath)) {
			if (fs.existsSync(dbPath)) {
				unlinkSqliteFamily(dbPath);
			}
			renameSqliteFamily(legacyPath, dbPath);
		}
		if (error instanceof DatabaseEncryptionError) throw error;
		throw new DatabaseEncryptionError(
			EncryptionMigrationFailedErrorCode,
			"Moat could not encrypt the local database. Your existing data was left as-is.",
		);
	}
}

export function reopenEncryptedFromPersistedKey(params: {
	dbPath: string;
	key: Buffer;
	nativeBinding?: string;
}): void {
	const db = openEncryptedSqliteConnection(params.dbPath, params.key, {
		fileMustExist: true,
		nativeBinding: params.nativeBinding,
	});
	closeNativeSqlite(db);
}
