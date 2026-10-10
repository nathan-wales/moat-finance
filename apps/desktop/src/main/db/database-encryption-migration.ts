import fs from "node:fs";
import {
	closeNativeSqlite,
	openEncryptedSqliteConnection,
	openPlaintextSqliteConnection,
	snapshotSqliteCatalog,
} from "@moat/db-sqlite";
import type { DatabaseKeyProvider } from "../vault/database-key-provider";
import {
	DatabaseCannotDecryptErrorCode,
	DatabaseEncryptionError,
	DatabaseFileMissingErrorCode,
	DatabaseIncompatibleVersionErrorCode,
	DatabaseKeyMissingErrorCode,
	EncryptionMigrationFailedErrorCode,
} from "./database-encryption-error";
import { validateEncryptedCandidate } from "./database-encryption-validation";
import {
	ENCRYPTED_MIGRATION_SUFFIX,
	encryptionArtifactsExist,
	LEGACY_PLAINTEXT_SUFFIX,
	productionDbPath,
	readFormatSidecar,
	renameSqliteFamily,
	SAFETY_COPY_SUFFIX,
	siblingPath,
	unlinkSqliteFamily,
	writeFormatSidecar,
} from "./database-paths";
import { detectDatabaseFormat } from "./detect-database-format";
import {
	migratePlaintextDatabase,
	reopenEncryptedFromPersistedKey,
} from "./encrypt-legacy-database";

export type EnsureEncryptedDatabaseResult = {
	dbPath: string;
	key: Buffer;
};

function logDiagnostic(message: string): void {
	console.warn("[db-encryption]", message);
}

function isEncryptedOpenable(
	dbPath: string,
	key: Buffer,
	nativeBinding?: string,
): boolean {
	try {
		const db = openEncryptedSqliteConnection(dbPath, key, {
			fileMustExist: true,
			nativeBinding,
		});
		closeNativeSqlite(db);
		return true;
	} catch {
		return false;
	}
}

function snapshotIfPlaintext(
	dbPath: string,
	nativeBinding?: string,
): ReturnType<typeof snapshotSqliteCatalog> | null {
	try {
		const db = openPlaintextSqliteConnection(dbPath, {
			fileMustExist: true,
			nativeBinding,
		});
		try {
			return snapshotSqliteCatalog(db);
		} finally {
			closeNativeSqlite(db);
		}
	} catch {
		return null;
	}
}

function restorePlaintextFamilyToProduction(
	sourcePath: string,
	dbPath: string,
	message: string,
): void {
	renameSqliteFamily(sourcePath, dbPath);
	logDiagnostic(message);
}

function restorePlaintextLeftoversWithoutKey(userDataPath: string): void {
	const dbPath = productionDbPath(userDataPath);
	if (fs.existsSync(dbPath)) return;

	const candidatePath = siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX);
	const safetyPath = siblingPath(dbPath, SAFETY_COPY_SUFFIX);
	const legacyPath = siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX);

	if (fs.existsSync(legacyPath)) {
		restorePlaintextFamilyToProduction(
			legacyPath,
			dbPath,
			"Restored plaintext production; encrypted candidate cannot be validated without a key.",
		);
		unlinkSqliteFamily(candidatePath);
		return;
	}

	if (fs.existsSync(safetyPath)) {
		restorePlaintextFamilyToProduction(
			safetyPath,
			dbPath,
			"Restored production from leftover safety copy.",
		);
	}
}

function cleanupLeftoverPlaintextArtifacts(userDataPath: string): void {
	const dbPath = productionDbPath(userDataPath);
	unlinkSqliteFamily(siblingPath(dbPath, SAFETY_COPY_SUFFIX));
	unlinkSqliteFamily(siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX));
	unlinkSqliteFamily(siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX));
}

export function recoverInterruptedEncryptionMigration(params: {
	userDataPath: string;
	key: Buffer | null;
	appVersion: string;
	nativeBinding?: string;
}): void {
	const dbPath = productionDbPath(params.userDataPath);
	const candidatePath = siblingPath(dbPath, ENCRYPTED_MIGRATION_SUFFIX);
	const safetyPath = siblingPath(dbPath, SAFETY_COPY_SUFFIX);
	const legacyPath = siblingPath(dbPath, LEGACY_PLAINTEXT_SUFFIX);
	const productionExists = fs.existsSync(dbPath);
	const candidateExists = fs.existsSync(candidatePath);
	const safetyExists = fs.existsSync(safetyPath);
	const legacyExists = fs.existsSync(legacyPath);

	if (productionExists && candidateExists) {
		unlinkSqliteFamily(candidatePath);
		logDiagnostic(
			"Removed incomplete encrypted candidate; production left in place.",
		);
	}

	if (!productionExists && legacyExists && candidateExists) {
		if (!params.key) {
			return;
		}
		const expected = snapshotIfPlaintext(legacyPath, params.nativeBinding);
		if (expected) {
			try {
				validateEncryptedCandidate({
					dbPath: candidatePath,
					key: params.key,
					expected,
					nativeBinding: params.nativeBinding,
				});
				renameSqliteFamily(candidatePath, dbPath);
				writeFormatSidecar(
					params.userDataPath,
					readFormatSidecar(params.userDataPath)?.minAppVersion ??
						params.appVersion,
				);
				logDiagnostic("Recovered encrypted candidate after interrupted swap.");
				return;
			} catch {
				renameSqliteFamily(legacyPath, dbPath);
				unlinkSqliteFamily(candidatePath);
				logDiagnostic(
					"Restored plaintext production after failed candidate validation.",
				);
				return;
			}
		}
		renameSqliteFamily(legacyPath, dbPath);
		unlinkSqliteFamily(candidatePath);
		return;
	}

	if (!productionExists && legacyExists && !candidateExists) {
		restorePlaintextFamilyToProduction(
			legacyPath,
			dbPath,
			"Restored plaintext production from leftover legacy file.",
		);
		return;
	}

	if (!productionExists && safetyExists) {
		restorePlaintextFamilyToProduction(
			safetyPath,
			dbPath,
			"Restored production from leftover safety copy.",
		);
		return;
	}

	if (productionExists && legacyExists) {
		if (!params.key) return;
		const expected = snapshotIfPlaintext(legacyPath, params.nativeBinding);
		if (expected) {
			try {
				validateEncryptedCandidate({
					dbPath,
					key: params.key,
					expected,
					nativeBinding: params.nativeBinding,
				});
				cleanupLeftoverPlaintextArtifacts(params.userDataPath);
				writeFormatSidecar(
					params.userDataPath,
					readFormatSidecar(params.userDataPath)?.minAppVersion ??
						params.appVersion,
				);
				logDiagnostic("Completed plaintext cleanup after interrupted cutover.");
				return;
			} catch {
				unlinkSqliteFamily(dbPath);
				renameSqliteFamily(legacyPath, dbPath);
				logDiagnostic(
					"Restored plaintext production after encrypted cutover failed validation.",
				);
				return;
			}
		}
		if (isEncryptedOpenable(dbPath, params.key, params.nativeBinding)) {
			logDiagnostic(
				"Left leftover plaintext in place; encrypted production opened but could not be checked against the legacy copy.",
			);
			return;
		}
		unlinkSqliteFamily(dbPath);
		renameSqliteFamily(legacyPath, dbPath);
		logDiagnostic(
			"Restored plaintext production after encrypted cutover failed.",
		);
		return;
	}

	if (
		safetyExists &&
		productionExists &&
		snapshotIfPlaintext(dbPath, params.nativeBinding)
	) {
		unlinkSqliteFamily(candidatePath);
	}
}

export async function ensureEncryptedDesktopDatabase(params: {
	userDataPath: string;
	keyProvider: DatabaseKeyProvider;
	vaultPassword?: string;
	allowCreate: boolean;
	appVersion: string;
	nativeBinding?: string;
}): Promise<EnsureEncryptedDatabaseResult> {
	const dbPath = productionDbPath(params.userDataPath);
	const format = detectDatabaseFormat(params.userDataPath, params.appVersion);

	if (format.kind === "incompatible") {
		throw new DatabaseEncryptionError(
			DatabaseIncompatibleVersionErrorCode,
			"This database was written by a newer Moat Finance. Install the latest version. Resetting deletes local data.",
		);
	}

	recoverInterruptedEncryptionMigration({
		userDataPath: params.userDataPath,
		key: null,
		appVersion: params.appVersion,
		nativeBinding: params.nativeBinding,
	});

	const blobExists = params.keyProvider.hasBlob();
	if (!blobExists) {
		restorePlaintextLeftoversWithoutKey(params.userDataPath);
	}

	const formatAfterCrash = detectDatabaseFormat(
		params.userDataPath,
		params.appVersion,
	);
	const artifactsExist = encryptionArtifactsExist(params.userDataPath);

	if (formatAfterCrash.kind === "encrypted" && !blobExists) {
		throw new DatabaseEncryptionError(
			DatabaseKeyMissingErrorCode,
			"Moat cannot open the local vault key for this database. The data file was left untouched.",
		);
	}

	if (!artifactsExist && !params.allowCreate) {
		throw new DatabaseEncryptionError(
			DatabaseFileMissingErrorCode,
			"Moat cannot find the local database file. The saved key was left untouched.",
		);
	}

	const createIfMissing =
		!blobExists &&
		(formatAfterCrash.kind === "plaintext" ||
			(params.allowCreate && !artifactsExist));

	const key = await params.keyProvider.getOrCreateKey({
		vaultPassword: params.vaultPassword,
		createIfMissing,
	});

	recoverInterruptedEncryptionMigration({
		userDataPath: params.userDataPath,
		key,
		appVersion: params.appVersion,
		nativeBinding: params.nativeBinding,
	});

	const formatReady = detectDatabaseFormat(
		params.userDataPath,
		params.appVersion,
	);

	if (formatReady.kind === "incompatible") {
		throw new DatabaseEncryptionError(
			DatabaseIncompatibleVersionErrorCode,
			"This database was written by a newer Moat Finance. Install the latest version. Resetting deletes local data.",
		);
	}

	if (formatReady.kind === "plaintext") {
		try {
			await migratePlaintextDatabase({
				userDataPath: params.userDataPath,
				dbPath,
				key,
				appVersion: params.appVersion,
				nativeBinding: params.nativeBinding,
				reloadKey: () =>
					params.keyProvider.getOrCreateKey({
						vaultPassword: params.vaultPassword,
						createIfMissing: false,
					}),
			});
		} catch (error) {
			if (error instanceof DatabaseEncryptionError) throw error;
			throw new DatabaseEncryptionError(
				EncryptionMigrationFailedErrorCode,
				"Moat could not encrypt the local database. Your existing data was left as-is.",
			);
		}
	}

	if (fs.existsSync(dbPath)) {
		try {
			reopenEncryptedFromPersistedKey({
				dbPath,
				key,
				nativeBinding: params.nativeBinding,
			});
		} catch {
			throw new DatabaseEncryptionError(
				DatabaseCannotDecryptErrorCode,
				"Moat cannot read the local database with the saved key. The file was not replaced.",
			);
		}
		writeFormatSidecar(
			params.userDataPath,
			readFormatSidecar(params.userDataPath)?.minAppVersion ??
				params.appVersion,
		);
		cleanupLeftoverPlaintextArtifacts(params.userDataPath);
	} else if (!params.allowCreate) {
		throw new DatabaseEncryptionError(
			DatabaseFileMissingErrorCode,
			"Moat cannot find the local database file. The saved key was left untouched.",
		);
	}

	return { dbPath, key };
}
