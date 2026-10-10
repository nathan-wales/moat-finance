import { z } from "zod";

export const VAULT_CHANNELS = {
	getStatus: "vault:getStatus",
	setup: "vault:setup",
	unlockWithPassword: "vault:unlockWithPassword",
	unlockWithBiometric: "vault:unlockWithBiometric",
	lock: "vault:lock",
	setBiometricEnabled: "vault:setBiometricEnabled",
	reset: "vault:reset",
	sendRecoveryCode: "vault:sendRecoveryCode",
	verifyRecoveryCode: "vault:verifyRecoveryCode",
	setRecoveryEmail: "vault:setRecoveryEmail",
	removeRecoveryEmail: "vault:removeRecoveryEmail",
	getRecoveryEmailStatus: "vault:getRecoveryEmailStatus",
	repairSafeStorage: "vault:repairSafeStorage",
} as const;

export const VaultLockedErrorCode = "VAULT_LOCKED" as const;
export const VaultInvalidCredentialErrorCode =
	"VAULT_INVALID_CREDENTIAL" as const;
export const VaultNotConfiguredErrorCode = "VAULT_NOT_CONFIGURED" as const;
export const VaultBiometricUnavailableErrorCode =
	"VAULT_BIOMETRIC_UNAVAILABLE" as const;
export const VaultBiometricCanceledErrorCode =
	"VAULT_BIOMETRIC_CANCELED" as const;
export const VaultRecoveryRateLimitedErrorCode =
	"VAULT_RECOVERY_RATE_LIMITED" as const;
export const VaultRecoveryInvalidCodeErrorCode =
	"VAULT_RECOVERY_INVALID_CODE" as const;
export const VaultRecoveryNotConfiguredErrorCode =
	"VAULT_RECOVERY_NOT_CONFIGURED" as const;
export const VaultRecoveryNetworkErrorCode =
	"VAULT_RECOVERY_NETWORK_ERROR" as const;
export const VaultRecoveryEmailFailedErrorCode =
	"VAULT_RECOVERY_EMAIL_FAILED" as const;
export const DatabaseKeyMissingErrorCode = "DATABASE_KEY_MISSING" as const;
export const DatabaseCannotDecryptErrorCode =
	"DATABASE_CANNOT_DECRYPT" as const;
export const KeyStorageUnavailableErrorCode =
	"KEY_STORAGE_UNAVAILABLE" as const;
export const DatabaseFileMissingErrorCode = "DATABASE_FILE_MISSING" as const;
export const DatabaseIncompatibleVersionErrorCode =
	"DATABASE_INCOMPATIBLE_VERSION" as const;
export const EncryptionMigrationFailedErrorCode =
	"ENCRYPTION_MIGRATION_FAILED" as const;
export const KeyUnwrapFailedErrorCode = "KEY_UNWRAP_FAILED" as const;
export const PasswordRecoveryKeyBoundErrorCode =
	"PASSWORD_RECOVERY_KEY_BOUND" as const;

export const VaultStatusSchema = z.object({
	configured: z.boolean(),
	unlocked: z.boolean(),
	biometricAvailable: z.boolean(),
	biometricEnabled: z.boolean(),
	safeStorageAvailable: z.boolean(),
	platform: z.enum(["darwin", "win32", "linux", "other"]),
	keyStorage: z.enum(["os_secure", "insecure_os_backend"]),
});

export type VaultStatus = z.infer<typeof VaultStatusSchema>;

export const GetVaultStatusInputSchema = z
	.object({
		/** Opt-in: probing safeStorage hits macOS Keychain and can re-prompt on every launch. */
		includeSafeStorageAvailability: z.boolean().optional(),
	})
	.optional();

export type GetVaultStatusInput = z.infer<typeof GetVaultStatusInputSchema>;

export const SetupVaultInputSchema = z.object({
	password: z.string().min(8),
	enableBiometric: z.boolean().optional(),
});

export type SetupVaultInput = z.infer<typeof SetupVaultInputSchema>;

export const UnlockWithPasswordInputSchema = z.object({
	password: z.string().min(1),
});

export type UnlockWithPasswordInput = z.infer<
	typeof UnlockWithPasswordInputSchema
>;

export const SetBiometricEnabledInputSchema = z.object({
	enabled: z.boolean(),
});

export type SetBiometricEnabledInput = z.infer<
	typeof SetBiometricEnabledInputSchema
>;

export const ResetVaultInputSchema = z.object({
	confirmPhrase: z.literal("RESET LOCAL VAULT"),
});

export type ResetVaultInput = z.infer<typeof ResetVaultInputSchema>;

export const SendRecoveryCodeInputSchema = z.object({
	email: z.string().email().optional(),
});

export type SendRecoveryCodeInput = z.infer<typeof SendRecoveryCodeInputSchema>;

export const VerifyRecoveryCodeInputSchema = z.object({
	email: z.string().email().optional(),
	code: z.string().length(6),
	newPassword: z.string().min(8),
});

export type VerifyRecoveryCodeInput = z.infer<
	typeof VerifyRecoveryCodeInputSchema
>;

export const SetRecoveryEmailInputSchema = z.object({
	email: z.string().email(),
	code: z.string().length(6),
});

export type SetRecoveryEmailInput = z.infer<typeof SetRecoveryEmailInputSchema>;

export const RemoveRecoveryEmailInputSchema = z.object({
	password: z.string().min(1),
});

export type RemoveRecoveryEmailInput = z.infer<
	typeof RemoveRecoveryEmailInputSchema
>;

export const RecoveryEmailStatusSchema = z.object({
	configured: z.boolean(),
	maskedEmail: z.string().nullable(),
	verified: z.boolean(),
});

export type RecoveryEmailStatus = z.infer<typeof RecoveryEmailStatusSchema>;

export const VaultActionResultSchema = z.object({
	ok: z.boolean(),
	errorCode: z.string().optional(),
});

export type VaultActionResult = z.infer<typeof VaultActionResultSchema>;

export const RepairSafeStorageResultSchema = z.object({
	encryptionAvailable: z.boolean(),
	probeSucceeded: z.boolean(),
	passwordManagerOpened: z.boolean(),
	platform: z.enum(["darwin", "win32", "linux", "other"]),
	message: z.string(),
});

export type RepairSafeStorageResult = z.infer<
	typeof RepairSafeStorageResultSchema
>;
