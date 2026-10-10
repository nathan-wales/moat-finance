export const DatabaseKeyMissingErrorCode = "DATABASE_KEY_MISSING" as const;
export const DatabaseCannotDecryptErrorCode =
	"DATABASE_CANNOT_DECRYPT" as const;
export const KeyStorageUnavailableErrorCode =
	"KEY_STORAGE_UNAVAILABLE" as const;
export const KeyUnwrapFailedErrorCode = "KEY_UNWRAP_FAILED" as const;
export const DatabaseFileMissingErrorCode = "DATABASE_FILE_MISSING" as const;
export const DatabaseIncompatibleVersionErrorCode =
	"DATABASE_INCOMPATIBLE_VERSION" as const;
export const EncryptionMigrationFailedErrorCode =
	"ENCRYPTION_MIGRATION_FAILED" as const;

export type DatabaseEncryptionErrorCode =
	| typeof DatabaseKeyMissingErrorCode
	| typeof DatabaseCannotDecryptErrorCode
	| typeof KeyStorageUnavailableErrorCode
	| typeof KeyUnwrapFailedErrorCode
	| typeof DatabaseFileMissingErrorCode
	| typeof DatabaseIncompatibleVersionErrorCode
	| typeof EncryptionMigrationFailedErrorCode;

export class DatabaseEncryptionError extends Error {
	readonly code: DatabaseEncryptionErrorCode;

	constructor(code: DatabaseEncryptionErrorCode, message: string) {
		super(message);
		this.name = "DatabaseEncryptionError";
		this.code = code;
	}
}

export function isDatabaseEncryptionError(
	error: unknown,
): error is DatabaseEncryptionError {
	return error instanceof DatabaseEncryptionError;
}
