/**
 * Gate Electron safeStorage so Keychain identity is established correctly.
 *
 * Electron can create a generic "Chromium" / wrong Keychain entry when
 * safeStorage is touched before app.whenReady() or before the first
 * BrowserWindow. Call markOsSafeStorageReady() after createWindow(), then use
 * these helpers instead of safeStorage directly.
 *
 * Main-process only — never import from the renderer.
 */
import { createRequire } from "node:module";

type ElectronSafeStorage = {
	isEncryptionAvailable: () => boolean;
	encryptString: (plaintext: string) => Buffer;
	decryptString: (encrypted: Buffer) => string;
};

type ElectronApp = { isReady: () => boolean };

export type TestOsSafeStorage = {
	encryptString: (plaintext: string) => Buffer;
	decryptString: (encrypted: Buffer) => string;
};

let _windowReady = false;
let _encryptionAvailable: boolean | null = null;
let testSafeStorage: TestOsSafeStorage | null = null;

function assertTestOnly(operation: string): void {
	if (process.env.NODE_ENV === "test" || process.env.MOAT_E2E === "1") return;
	throw new Error(`${operation} is test-only`);
}

export function installTestOsSafeStorage(
	backend: TestOsSafeStorage | null,
): void {
	assertTestOnly("installTestOsSafeStorage");
	testSafeStorage = backend;
	_encryptionAvailable = backend ? true : null;
}

function loadElectron(): {
	app: ElectronApp;
	safeStorage: ElectronSafeStorage;
} {
	const require = createRequire(import.meta.url);
	return require("electron") as {
		app: ElectronApp;
		safeStorage: ElectronSafeStorage;
	};
}

export function markOsSafeStorageReady(): void {
	_windowReady = true;
}

function assertOsSafeStorageReady(): void {
	if (testSafeStorage) return;
	const { app } = loadElectron();
	if (!app.isReady()) {
		throw new Error("OS secure storage used before app.whenReady()");
	}
	if (!_windowReady) {
		throw new Error("OS secure storage used before BrowserWindow was created");
	}
}

/**
 * Whether OS-backed encryption is available.
 * Result is cached for the process lifetime after the first successful probe so
 * later encrypt/decrypt calls do not re-hit Keychain solely for availability.
 */
export function isOsEncryptionAvailable(): boolean {
	if (testSafeStorage) return true;
	assertOsSafeStorageReady();
	if (_encryptionAvailable !== null) {
		return _encryptionAvailable;
	}
	const { safeStorage } = loadElectron();
	_encryptionAvailable = safeStorage.isEncryptionAvailable();
	return _encryptionAvailable;
}

export function encryptOsString(plaintext: string): Buffer {
	assertOsSafeStorageReady();
	if (testSafeStorage) return testSafeStorage.encryptString(plaintext);
	if (!isOsEncryptionAvailable()) {
		throw new Error("Encryption is not available.");
	}
	const { safeStorage } = loadElectron();
	return safeStorage.encryptString(plaintext);
}

export function decryptOsString(encrypted: Buffer): string {
	assertOsSafeStorageReady();
	const payload = Buffer.isBuffer(encrypted)
		? encrypted
		: Buffer.from(encrypted);
	if (testSafeStorage) return testSafeStorage.decryptString(payload);
	if (!isOsEncryptionAvailable()) {
		throw new Error("Decryption is not available.");
	}
	const { safeStorage } = loadElectron();
	return safeStorage.decryptString(payload);
}

export type OsEncryptResult = {
	encrypted: Buffer;
	shouldReEncrypt: boolean;
};

export type OsDecryptResult = {
	decrypted: string;
	shouldReEncrypt: boolean;
	isTemporarilyUnavailable: boolean;
};

type AsyncSafeStorage = ElectronSafeStorage & {
	encryptStringAsync?: (plaintext: string) => Promise<{
		encrypted?: Buffer;
		encryptedBuffer?: Buffer;
		shouldReEncrypt?: boolean;
	}>;
	decryptStringAsync?: (encrypted: Buffer) => Promise<{
		decrypted?: string;
		plaintext?: string;
		shouldReEncrypt?: boolean;
		isTemporarilyUnavailable?: boolean;
	}>;
	getSelectedStorageBackend?: () => string;
};

export async function encryptOsStringAsync(
	plaintext: string,
): Promise<OsEncryptResult> {
	assertOsSafeStorageReady();
	if (testSafeStorage) {
		return {
			encrypted: testSafeStorage.encryptString(plaintext),
			shouldReEncrypt: false,
		};
	}
	if (!isOsEncryptionAvailable()) {
		throw new Error("Encryption is not available.");
	}
	const { safeStorage } = loadElectron();
	const asyncApi = safeStorage as AsyncSafeStorage;
	if (typeof asyncApi.encryptStringAsync === "function") {
		const result = await asyncApi.encryptStringAsync(plaintext);
		const encrypted = result.encryptedBuffer ?? result.encrypted;
		if (!encrypted) {
			throw new Error("Encryption produced an empty payload.");
		}
		return {
			encrypted,
			shouldReEncrypt: result.shouldReEncrypt === true,
		};
	}
	return {
		encrypted: encryptOsString(plaintext),
		shouldReEncrypt: false,
	};
}

export async function decryptOsStringAsync(
	encrypted: Buffer,
): Promise<OsDecryptResult> {
	assertOsSafeStorageReady();
	if (testSafeStorage) {
		return {
			decrypted: testSafeStorage.decryptString(encrypted),
			shouldReEncrypt: false,
			isTemporarilyUnavailable: false,
		};
	}
	if (!isOsEncryptionAvailable()) {
		throw new Error("Decryption is not available.");
	}
	const { safeStorage } = loadElectron();
	const asyncApi = safeStorage as AsyncSafeStorage;
	if (typeof asyncApi.decryptStringAsync === "function") {
		try {
			const result = await asyncApi.decryptStringAsync(encrypted);
			const decrypted = result.decrypted ?? result.plaintext;
			if (typeof decrypted !== "string") {
				throw new Error("Decryption produced an empty payload.");
			}
			return {
				decrypted,
				shouldReEncrypt: result.shouldReEncrypt === true,
				isTemporarilyUnavailable: result.isTemporarilyUnavailable === true,
			};
		} catch (error) {
			if (isTemporarilyUnavailableError(error)) {
				return {
					decrypted: "",
					shouldReEncrypt: false,
					isTemporarilyUnavailable: true,
				};
			}
			throw error;
		}
	}
	try {
		return {
			decrypted: decryptOsString(encrypted),
			shouldReEncrypt: false,
			isTemporarilyUnavailable: false,
		};
	} catch (error) {
		if (isTemporarilyUnavailableError(error)) {
			return {
				decrypted: "",
				shouldReEncrypt: false,
				isTemporarilyUnavailable: true,
			};
		}
		throw error;
	}
}

export function getLinuxStorageBackend(): string | null {
	if (process.platform !== "linux") return null;
	if (testSafeStorage) return null;
	const { safeStorage } = loadElectron();
	const asyncApi = safeStorage as AsyncSafeStorage;
	if (typeof asyncApi.getSelectedStorageBackend !== "function") {
		return "unknown";
	}
	try {
		return asyncApi.getSelectedStorageBackend();
	} catch {
		return "unknown";
	}
}

export function isInsecureLinuxKeyBackend(backend: string | null): boolean {
	if (process.platform !== "linux") return false;
	return backend === "basic_text" || backend === "unknown" || backend === null;
}

function isTemporarilyUnavailableError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /temporar/i.test(message) || /unavailable/i.test(message);
}

/** Clear the availability cache (tests / after repair probes that may change state). */
export function resetOsEncryptionAvailabilityCache(): void {
	_encryptionAvailable = null;
}
