import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type VaultConfigFileV1 = {
	version: 1;
	passwordHash: string;
	passwordSalt: string;
	biometricEnabled: boolean;
};

export type VaultConfigFile = {
	version: 2;
	passwordHash: string;
	passwordSalt: string;
	biometricEnabled: boolean;
	recoveryDeviceId: string;
	recoveryEmailNormalized?: string;
	recoveryEmailVerifiedAt?: string;
};

const VAULT_DIR = "vault";
const CONFIG_FILE = "vault-config.json";

export function normalizeRecoveryEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function maskRecoveryEmail(email: string): string {
	const normalized = normalizeRecoveryEmail(email);
	const atIndex = normalized.indexOf("@");
	if (atIndex <= 0) return "•••";
	const local = normalized.slice(0, atIndex);
	const domain = normalized.slice(atIndex + 1);
	if (!domain) return "•••";
	return `${local[0] ?? ""}•••@${domain}`;
}

function migrateVaultConfig(
	raw: VaultConfigFileV1 | VaultConfigFile,
): VaultConfigFile {
	if (raw.version === 2) {
		return raw;
	}

	return {
		version: 2,
		passwordHash: raw.passwordHash,
		passwordSalt: raw.passwordSalt,
		biometricEnabled: raw.biometricEnabled,
		recoveryDeviceId: randomUUID(),
	};
}

export function createInitialVaultConfig(input: {
	passwordHash: string;
	passwordSalt: string;
	biometricEnabled: boolean;
}): VaultConfigFile {
	return {
		version: 2,
		passwordHash: input.passwordHash,
		passwordSalt: input.passwordSalt,
		biometricEnabled: input.biometricEnabled,
		recoveryDeviceId: randomUUID(),
	};
}

export function getVaultConfigPath(userDataPath: string): string {
	return path.join(userDataPath, VAULT_DIR, CONFIG_FILE);
}

export function readVaultConfig(userDataPath: string): VaultConfigFile | null {
	const filePath = getVaultConfigPath(userDataPath);
	if (!fs.existsSync(filePath)) return null;
	try {
		const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as
			| VaultConfigFileV1
			| VaultConfigFile;
		return migrateVaultConfig(raw);
	} catch {
		return null;
	}
}

export function writeVaultConfig(
	userDataPath: string,
	config: VaultConfigFile,
): void {
	const dir = path.join(userDataPath, VAULT_DIR);
	fs.mkdirSync(dir, { recursive: true });
	const filePath = getVaultConfigPath(userDataPath);
	fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
}

export function deleteVaultConfig(userDataPath: string): void {
	const filePath = getVaultConfigPath(userDataPath);
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}
}

export function isVaultConfigured(userDataPath: string): boolean {
	return readVaultConfig(userDataPath) !== null;
}

export function ensureRecoveryDeviceId(
	userDataPath: string,
	config: VaultConfigFile,
): VaultConfigFile {
	if (config.recoveryDeviceId) {
		return config;
	}

	const next = {
		...config,
		recoveryDeviceId: randomUUID(),
	};
	writeVaultConfig(userDataPath, next);
	return next;
}
