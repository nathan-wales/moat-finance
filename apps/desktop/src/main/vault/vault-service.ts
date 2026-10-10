import fs from "node:fs";
import path from "node:path";
import {
	PasswordRecoveryKeyBoundErrorCode,
	type RecoveryEmailStatus,
	type VaultActionResult,
	VaultBiometricCanceledErrorCode,
	VaultBiometricUnavailableErrorCode,
	VaultInvalidCredentialErrorCode,
	VaultRecoveryEmailFailedErrorCode,
	VaultRecoveryInvalidCodeErrorCode,
	VaultRecoveryNetworkErrorCode,
	VaultRecoveryNotConfiguredErrorCode,
	VaultRecoveryRateLimitedErrorCode,
	type VaultStatus,
} from "@moat/contracts";
import { systemPreferences } from "electron";
import { isPasswordWrappedKeyBlob } from "./database-key-provider";
import {
	getLinuxStorageBackend,
	isInsecureLinuxKeyBackend,
	isOsEncryptionAvailable,
} from "./os-safe-storage";
import { hashVaultPassword, verifyVaultPassword } from "./password-hash";
import {
	consumeRecoveryTokenRequest,
	RecoveryApiError,
	registerRecoveryEmailRequest,
	sendRecoveryCodeRequest,
	unregisterRecoveryRequest,
	verifyRecoveryCodeRequest,
} from "./recovery-service";
import {
	createInitialVaultConfig,
	deleteVaultConfig,
	ensureRecoveryDeviceId,
	isVaultConfigured,
	maskRecoveryEmail,
	normalizeRecoveryEmail,
	readVaultConfig,
	writeVaultConfig,
} from "./vault-config";

let _unlocked = false;
let _userDataPath = "";

export function initVaultService(userDataPath: string): void {
	_userDataPath = userDataPath;
	_unlocked = false;
}

export function isVaultUnlocked(): boolean {
	return _unlocked;
}

export function assertVaultUnlocked(): void {
	if (!_unlocked) {
		const err = new Error("Local vault is locked");
		(err as Error & { code: string }).code = "VAULT_LOCKED";
		throw err;
	}
}

export function lockVault(): void {
	_unlocked = false;
}

export function unlockVaultSession(): void {
	_unlocked = true;
}

function resolvePlatform(): VaultStatus["platform"] {
	if (process.platform === "darwin") return "darwin";
	if (process.platform === "win32") return "win32";
	if (process.platform === "linux") return "linux";
	return "other";
}

function resolveKeyStorage(): VaultStatus["keyStorage"] {
	try {
		return isInsecureLinuxKeyBackend(getLinuxStorageBackend())
			? "insecure_os_backend"
			: "os_secure";
	} catch {
		return process.platform === "linux" ? "insecure_os_backend" : "os_secure";
	}
}

function isBiometricAvailable(): boolean {
	if (process.platform !== "darwin") return false;
	try {
		return systemPreferences.canPromptTouchID();
	} catch {
		return false;
	}
}

function isBiometricCancelError(error: unknown): boolean {
	const message =
		typeof error === "string"
			? error
			: error instanceof Error
				? error.message
				: "";
	return /cancel/i.test(message);
}

function getConfiguredVaultConfig() {
	if (!_userDataPath) return null;
	const config = readVaultConfig(_userDataPath);
	if (!config) return null;
	return ensureRecoveryDeviceId(_userDataPath, config);
}

function mapRecoveryApiError(error: unknown): VaultActionResult {
	if (error instanceof RecoveryApiError) {
		if (error.status === 429) {
			return { ok: false, errorCode: VaultRecoveryRateLimitedErrorCode };
		}
		if (error.status === 400) {
			return { ok: false, errorCode: VaultRecoveryInvalidCodeErrorCode };
		}
		if (error.status === 502) {
			return { ok: false, errorCode: VaultRecoveryEmailFailedErrorCode };
		}
		return { ok: false, errorCode: VaultRecoveryNetworkErrorCode };
	}
	return { ok: false, errorCode: VaultRecoveryNetworkErrorCode };
}

export function getVaultStatus(input?: {
	includeSafeStorageAvailability?: boolean;
}): VaultStatus {
	const config = _userDataPath ? readVaultConfig(_userDataPath) : null;
	// Opt-in only: probing OS encryption hits macOS Keychain and can prompt.
	// Cold-start / unlock paths keep includeSafeStorageAvailability false.
	return {
		configured: config !== null,
		unlocked: _unlocked,
		biometricAvailable: isBiometricAvailable(),
		biometricEnabled: config?.biometricEnabled ?? false,
		safeStorageAvailable:
			input?.includeSafeStorageAvailability === true
				? isOsEncryptionAvailable()
				: false,
		platform: resolvePlatform(),
		keyStorage: resolveKeyStorage(),
	};
}

export function getRecoveryEmailStatus(): RecoveryEmailStatus {
	const config = getConfiguredVaultConfig();
	if (!config?.recoveryEmailNormalized || !config.recoveryEmailVerifiedAt) {
		return {
			configured: false,
			maskedEmail: null,
			verified: false,
		};
	}

	return {
		configured: true,
		maskedEmail: maskRecoveryEmail(config.recoveryEmailNormalized),
		verified: true,
	};
}

function clearIncompleteVaultSetup(userDataPath: string): void {
	const dbPath = path.join(userDataPath, "moat.db");
	if (fs.existsSync(dbPath)) return;
	// Config written but DB never opened — allow first-run setup to retry.
	deleteVaultConfig(userDataPath);
	_unlocked = false;
}

export async function setupVault(input: {
	password: string;
	enableBiometric?: boolean;
}): Promise<VaultActionResult> {
	if (!_userDataPath) {
		return { ok: false, errorCode: "VAULT_INTERNAL_ERROR" };
	}
	if (isVaultConfigured(_userDataPath)) {
		clearIncompleteVaultSetup(_userDataPath);
	}
	if (isVaultConfigured(_userDataPath)) {
		return { ok: false, errorCode: "VAULT_ALREADY_CONFIGURED" };
	}

	const enableBiometric = input.enableBiometric === true;
	if (enableBiometric && !isBiometricAvailable()) {
		return { ok: false, errorCode: VaultBiometricUnavailableErrorCode };
	}

	const { hash, salt } = await hashVaultPassword(input.password);
	writeVaultConfig(
		_userDataPath,
		createInitialVaultConfig({
			passwordHash: hash,
			passwordSalt: salt,
			biometricEnabled: enableBiometric,
		}),
	);
	unlockVaultSession();
	return { ok: true };
}

export async function unlockWithPassword(
	password: string,
): Promise<VaultActionResult> {
	if (!_userDataPath) {
		return { ok: false, errorCode: "VAULT_INTERNAL_ERROR" };
	}
	const config = readVaultConfig(_userDataPath);
	if (!config) {
		return { ok: false, errorCode: "VAULT_NOT_CONFIGURED" };
	}

	const valid = await verifyVaultPassword(
		password,
		config.passwordSalt,
		config.passwordHash,
	);
	if (!valid) {
		return { ok: false, errorCode: VaultInvalidCredentialErrorCode };
	}

	unlockVaultSession();
	return { ok: true };
}

export async function unlockWithBiometric(): Promise<VaultActionResult> {
	if (!_userDataPath) {
		return { ok: false, errorCode: "VAULT_INTERNAL_ERROR" };
	}
	const config = readVaultConfig(_userDataPath);
	if (!config) {
		return { ok: false, errorCode: "VAULT_NOT_CONFIGURED" };
	}
	if (!config.biometricEnabled) {
		return { ok: false, errorCode: VaultBiometricUnavailableErrorCode };
	}
	if (!isBiometricAvailable()) {
		return { ok: false, errorCode: VaultBiometricUnavailableErrorCode };
	}

	try {
		await systemPreferences.promptTouchID(
			"Moat is trying to unlock your local vault.",
		);
	} catch (error) {
		if (isBiometricCancelError(error)) {
			return { ok: false, errorCode: VaultBiometricCanceledErrorCode };
		}
		return { ok: false, errorCode: VaultInvalidCredentialErrorCode };
	}

	unlockVaultSession();
	return { ok: true };
}

export function setBiometricEnabled(enabled: boolean): VaultActionResult {
	if (!_userDataPath) {
		return { ok: false, errorCode: "VAULT_INTERNAL_ERROR" };
	}
	const config = getConfiguredVaultConfig();
	if (!config) {
		return { ok: false, errorCode: "VAULT_NOT_CONFIGURED" };
	}
	if (enabled && !isBiometricAvailable()) {
		return { ok: false, errorCode: VaultBiometricUnavailableErrorCode };
	}

	writeVaultConfig(_userDataPath, {
		...config,
		biometricEnabled: enabled,
	});
	return { ok: true };
}

export async function sendRecoveryCode(
	email?: string,
): Promise<VaultActionResult> {
	const config = getConfiguredVaultConfig();
	if (!config) {
		return { ok: false, errorCode: "VAULT_NOT_CONFIGURED" };
	}

	const targetEmail =
		email != null
			? normalizeRecoveryEmail(email)
			: config.recoveryEmailNormalized;

	if (!targetEmail) {
		return { ok: false, errorCode: VaultRecoveryNotConfiguredErrorCode };
	}

	try {
		await sendRecoveryCodeRequest({
			recoveryDeviceId: config.recoveryDeviceId,
			email: targetEmail,
		});
		return { ok: true };
	} catch (error) {
		return mapRecoveryApiError(error);
	}
}

export async function verifyRecoveryCode(input: {
	email?: string;
	code: string;
	newPassword: string;
}): Promise<VaultActionResult> {
	if (_unlocked) {
		return { ok: false, errorCode: "VAULT_ALREADY_UNLOCKED" };
	}
	if (!_userDataPath) {
		return { ok: false, errorCode: "VAULT_INTERNAL_ERROR" };
	}

	const config = getConfiguredVaultConfig();
	if (!config) {
		return { ok: false, errorCode: "VAULT_NOT_CONFIGURED" };
	}

	if (!config.recoveryEmailNormalized) {
		return { ok: false, errorCode: VaultRecoveryNotConfiguredErrorCode };
	}

	if (isPasswordWrappedKeyBlob(_userDataPath)) {
		return { ok: false, errorCode: PasswordRecoveryKeyBoundErrorCode };
	}

	try {
		const { recoveryToken } = await verifyRecoveryCodeRequest({
			recoveryDeviceId: config.recoveryDeviceId,
			email: config.recoveryEmailNormalized,
			code: input.code,
		});

		await consumeRecoveryTokenRequest({
			recoveryDeviceId: config.recoveryDeviceId,
			recoveryToken,
		});

		const { hash, salt } = await hashVaultPassword(input.newPassword);
		writeVaultConfig(_userDataPath, {
			...config,
			passwordHash: hash,
			passwordSalt: salt,
		});
		unlockVaultSession();
		return { ok: true };
	} catch (error) {
		return mapRecoveryApiError(error);
	}
}

export async function setRecoveryEmail(input: {
	email: string;
	code: string;
}): Promise<VaultActionResult> {
	if (!_unlocked) {
		return { ok: false, errorCode: "VAULT_LOCKED" };
	}
	if (!_userDataPath) {
		return { ok: false, errorCode: "VAULT_INTERNAL_ERROR" };
	}

	const config = getConfiguredVaultConfig();
	if (!config) {
		return { ok: false, errorCode: "VAULT_NOT_CONFIGURED" };
	}

	const normalizedEmail = normalizeRecoveryEmail(input.email);

	try {
		await registerRecoveryEmailRequest({
			recoveryDeviceId: config.recoveryDeviceId,
			email: normalizedEmail,
			code: input.code,
		});

		writeVaultConfig(_userDataPath, {
			...config,
			recoveryEmailNormalized: normalizedEmail,
			recoveryEmailVerifiedAt: new Date().toISOString(),
		});
		return { ok: true };
	} catch (error) {
		return mapRecoveryApiError(error);
	}
}

export async function removeRecoveryEmail(
	password: string,
): Promise<VaultActionResult> {
	if (!_unlocked) {
		return { ok: false, errorCode: "VAULT_LOCKED" };
	}
	if (!_userDataPath) {
		return { ok: false, errorCode: "VAULT_INTERNAL_ERROR" };
	}

	const config = getConfiguredVaultConfig();
	if (!config) {
		return { ok: false, errorCode: "VAULT_NOT_CONFIGURED" };
	}

	const valid = await verifyVaultPassword(
		password,
		config.passwordSalt,
		config.passwordHash,
	);
	if (!valid) {
		return { ok: false, errorCode: VaultInvalidCredentialErrorCode };
	}

	try {
		await unregisterRecoveryRequest({
			recoveryDeviceId: config.recoveryDeviceId,
		});
	} catch {
		// Local removal should proceed even if cloud unregister fails.
	}

	writeVaultConfig(_userDataPath, {
		...config,
		recoveryEmailNormalized: undefined,
		recoveryEmailVerifiedAt: undefined,
	});
	return { ok: true };
}

export async function unregisterRecoveryOnReset(
	recoveryDeviceId: string,
): Promise<void> {
	try {
		await unregisterRecoveryRequest({ recoveryDeviceId });
	} catch {
		// Destructive reset should proceed even if cloud unregister fails.
	}
}

export function clearVaultConfiguration(): void {
	if (_userDataPath) {
		deleteVaultConfig(_userDataPath);
	}
	lockVault();
}
