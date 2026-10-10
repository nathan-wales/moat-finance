import { createHash, randomBytes, randomInt } from "node:crypto";

const RECOVERY_TOKEN_BYTES = 32;
const CODE_LENGTH = 6;

export function normalizeRecoveryEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function getVaultRecoveryPepper(): string {
	const pepper =
		process.env.VAULT_RECOVERY_PEPPER ?? process.env.MCP_TOKEN_PEPPER;
	if (pepper) {
		if (pepper.length < 32) {
			throw new Error("VAULT_RECOVERY_PEPPER must be at least 32 characters");
		}
		return pepper;
	}
	if (process.env.NODE_ENV === "production") {
		throw new Error("VAULT_RECOVERY_PEPPER is required in production");
	}

	const fallbackPepper = process.env.DATABASE_URL;
	if (!fallbackPepper) {
		throw new Error("Vault recovery pepper is not configured");
	}
	return fallbackPepper;
}

export function hashRecoveryEmail(email: string): string {
	return createHash("sha256")
		.update(normalizeRecoveryEmail(email))
		.update(getVaultRecoveryPepper())
		.digest("hex");
}

export function hashRecoveryCode(code: string): string {
	return createHash("sha256")
		.update(code)
		.update(getVaultRecoveryPepper())
		.digest("hex");
}

export function hashRecoveryToken(token: string): string {
	return createHash("sha256")
		.update(token)
		.update(getVaultRecoveryPepper())
		.digest("hex");
}

export function generateRecoveryCode(): string {
	return randomInt(0, 10 ** CODE_LENGTH)
		.toString()
		.padStart(CODE_LENGTH, "0");
}

export function generateRecoveryToken(): string {
	return randomBytes(RECOVERY_TOKEN_BYTES).toString("base64url");
}
