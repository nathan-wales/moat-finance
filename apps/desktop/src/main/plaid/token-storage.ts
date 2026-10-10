/**
 * Secure access token storage using Electron's safeStorage API.
 *
 * Encryption uses the OS keychain/Credential Manager (Keychain on macOS,
 * DPAPI on Windows, libsecret on Linux). Call sites must run after
 * markOsSafeStorageReady() in the main process startup sequence.
 *
 * Main-process only — never import from the renderer.
 */
import {
	decryptOsString,
	encryptOsString,
	isOsEncryptionAvailable,
} from "../vault/os-safe-storage";

export const SECURE_STORAGE_UNAVAILABLE_PREFIX =
	"SECURE_STORAGE_UNAVAILABLE" as const;

function toSecureStorageError(error: unknown): Error {
	const detail =
		error instanceof Error ? error.message : "Decryption is not available.";
	return new Error(`${SECURE_STORAGE_UNAVAILABLE_PREFIX}: ${detail}`);
}

/**
 * Encrypts a Plaid access token using the OS keychain.
 * Returns a Buffer suitable for storage in SQLite as BLOB.
 */
export function encryptAccessToken(plaintext: string): Buffer {
	try {
		if (!isOsEncryptionAvailable()) {
			throw new Error("Encryption is not available.");
		}
		return encryptOsString(plaintext);
	} catch (error) {
		throw toSecureStorageError(error);
	}
}

/**
 * Decrypts a Plaid access token previously encrypted with encryptAccessToken.
 * Throws if the stored bytes cannot be decrypted (e.g., OS account changed).
 */
export function decryptAccessToken(encrypted: Buffer): string {
	try {
		if (!isOsEncryptionAvailable()) {
			throw new Error("Decryption is not available.");
		}
		return decryptOsString(encrypted);
	} catch (error) {
		throw toSecureStorageError(error);
	}
}
