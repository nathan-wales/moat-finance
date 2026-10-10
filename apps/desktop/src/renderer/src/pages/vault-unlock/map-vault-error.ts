import {
	DatabaseCannotDecryptErrorCode,
	DatabaseFileMissingErrorCode,
	DatabaseIncompatibleVersionErrorCode,
	DatabaseKeyMissingErrorCode,
	EncryptionMigrationFailedErrorCode,
	KeyStorageUnavailableErrorCode,
	KeyUnwrapFailedErrorCode,
	PasswordRecoveryKeyBoundErrorCode,
	VaultBiometricCanceledErrorCode,
	VaultBiometricUnavailableErrorCode,
	VaultInvalidCredentialErrorCode,
} from "@moat/contracts";

export function mapVaultErrorMessage(errorCode?: string): string {
	if (errorCode === VaultInvalidCredentialErrorCode) {
		return "Incorrect app password.";
	}
	if (errorCode === DatabaseKeyMissingErrorCode) {
		return "Moat cannot open the local vault key for this database. The data file was left untouched.";
	}
	if (errorCode === DatabaseCannotDecryptErrorCode) {
		return "Moat cannot read the local database with the saved key. The file was not replaced.";
	}
	if (errorCode === KeyStorageUnavailableErrorCode) {
		return "This device’s secure storage is locked or unavailable.";
	}
	if (errorCode === KeyUnwrapFailedErrorCode) {
		return "Moat cannot open the local vault key for this database. The data file was left untouched.";
	}
	if (errorCode === PasswordRecoveryKeyBoundErrorCode) {
		return "Password recovery cannot open the local database on this Linux session. The database key is protected by your app password.";
	}
	if (errorCode === DatabaseIncompatibleVersionErrorCode) {
		return "This database was written by a newer Moat Finance. Install the latest version. Resetting deletes local data.";
	}
	if (errorCode === EncryptionMigrationFailedErrorCode) {
		return "Moat could not encrypt the local database. Your existing data was left as-is.";
	}
	if (errorCode === DatabaseFileMissingErrorCode) {
		return "Moat cannot find the local database file. The saved key was left untouched.";
	}
	if (errorCode === "VAULT_INTERNAL_ERROR") {
		return "Could not open the local database. Reinstall Moat Desktop and try again.";
	}
	return "Could not open the local vault. Try again.";
}

export function mapBiometricUnlockError(errorCode?: string): string {
	if (
		errorCode == null ||
		errorCode === VaultBiometricCanceledErrorCode ||
		errorCode === VaultInvalidCredentialErrorCode
	) {
		return "Touch ID was not accepted. Try again.";
	}
	if (errorCode === VaultBiometricUnavailableErrorCode) {
		return "Touch ID is not available. Enter your app password.";
	}
	return mapVaultErrorMessage(errorCode);
}

export function isIncompatibleDatabaseError(errorCode?: string): boolean {
	return errorCode === DatabaseIncompatibleVersionErrorCode;
}

export function isRepairableKeyStorageError(errorCode?: string): boolean {
	return (
		errorCode === KeyStorageUnavailableErrorCode ||
		errorCode === KeyUnwrapFailedErrorCode
	);
}
