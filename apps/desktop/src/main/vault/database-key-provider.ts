import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scrypt,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
	DatabaseEncryptionError,
	DatabaseKeyMissingErrorCode,
	KeyStorageUnavailableErrorCode,
	KeyUnwrapFailedErrorCode,
} from "../db/database-encryption-error";
import { databaseKeyPath } from "../db/database-paths";
import type {
	KeyStorageKind,
	OsCryptoGate,
} from "./database-key-provider-types";

const scryptAsync = promisify(scrypt);

const MAGIC = Buffer.from("MDBK");
const BLOB_VERSION = 1;
const KIND_OS = 1;
const KIND_PASSWORD = 2;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_SALT_LENGTH = 16;
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const SQLCIPHER_KEY_BYTES = 32;

export type { KeyStorageKind, OsCryptoGate };

export type DatabaseKeyProvider = {
	hasBlob: () => boolean;
	keyStorage: () => KeyStorageKind;
	getOrCreateKey: (options: {
		vaultPassword?: string;
		createIfMissing: boolean;
	}) => Promise<Buffer>;
	rewrapIfPasswordWrapped: (password: string) => Promise<void>;
	deleteBlob: () => void;
};

function isInsecureLinuxKeyBackend(backend: string | null): boolean {
	return backend === "basic_text" || backend === "unknown" || backend === null;
}

function usesPasswordWrap(osCrypto: OsCryptoGate): boolean {
	const platform = osCrypto.platform ?? process.platform;
	if (platform !== "linux") return false;
	return isInsecureLinuxKeyBackend(osCrypto.getLinuxStorageBackend());
}

function parseBlob(blob: Buffer): { kind: number; payload: Buffer } {
	if (blob.length < 6 || !blob.subarray(0, 4).equals(MAGIC)) {
		throw new DatabaseEncryptionError(
			KeyUnwrapFailedErrorCode,
			"Database key blob is not recognized.",
		);
	}
	const version = blob[4];
	const kind = blob[5];
	if (
		version !== BLOB_VERSION ||
		(kind !== KIND_OS && kind !== KIND_PASSWORD)
	) {
		throw new DatabaseEncryptionError(
			KeyUnwrapFailedErrorCode,
			"Database key blob version is not supported.",
		);
	}
	return { kind, payload: blob.subarray(6) };
}

function encodeBlob(kind: number, payload: Buffer): Buffer {
	return Buffer.concat([MAGIC, Buffer.from([BLOB_VERSION, kind]), payload]);
}

async function wrapWithPassword(
	rawKey: Buffer,
	password: string,
): Promise<Buffer> {
	const salt = randomBytes(SCRYPT_SALT_LENGTH);
	const wrappingKey = (await scryptAsync(
		password,
		salt,
		SCRYPT_KEY_LENGTH,
	)) as Buffer;
	const iv = randomBytes(GCM_IV_LENGTH);
	const cipher = createCipheriv("aes-256-gcm", wrappingKey, iv);
	const ciphertext = Buffer.concat([cipher.update(rawKey), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([salt, iv, tag, ciphertext]);
}

async function unwrapWithPassword(
	payload: Buffer,
	password: string,
): Promise<Buffer> {
	const minLength =
		SCRYPT_SALT_LENGTH + GCM_IV_LENGTH + GCM_TAG_LENGTH + SQLCIPHER_KEY_BYTES;
	if (payload.length < minLength) {
		throw new DatabaseEncryptionError(
			KeyUnwrapFailedErrorCode,
			"Database key blob is truncated.",
		);
	}
	const salt = payload.subarray(0, SCRYPT_SALT_LENGTH);
	const iv = payload.subarray(
		SCRYPT_SALT_LENGTH,
		SCRYPT_SALT_LENGTH + GCM_IV_LENGTH,
	);
	const tag = payload.subarray(
		SCRYPT_SALT_LENGTH + GCM_IV_LENGTH,
		SCRYPT_SALT_LENGTH + GCM_IV_LENGTH + GCM_TAG_LENGTH,
	);
	const ciphertext = payload.subarray(
		SCRYPT_SALT_LENGTH + GCM_IV_LENGTH + GCM_TAG_LENGTH,
	);
	const wrappingKey = (await scryptAsync(
		password,
		salt,
		SCRYPT_KEY_LENGTH,
	)) as Buffer;
	try {
		const decipher = createDecipheriv("aes-256-gcm", wrappingKey, iv);
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	} catch {
		throw new DatabaseEncryptionError(
			KeyUnwrapFailedErrorCode,
			"Could not unwrap the database key with the app password.",
		);
	}
}

function writeBlobAtomic(filePath: string, blob: Buffer): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tmp = `${filePath}.tmp`;
	fs.writeFileSync(tmp, blob);
	if (process.platform !== "win32") {
		fs.chmodSync(tmp, 0o600);
	}
	fs.renameSync(tmp, filePath);
	if (process.platform !== "win32") {
		fs.chmodSync(filePath, 0o600);
	}
}

export function isPasswordWrappedKeyBlob(userDataPath: string): boolean {
	const filePath = databaseKeyPath(userDataPath);
	if (!fs.existsSync(filePath)) return false;
	const blob = fs.readFileSync(filePath);
	if (blob.length < 6 || !blob.subarray(0, 4).equals(MAGIC)) return false;
	return blob[4] === BLOB_VERSION && blob[5] === KIND_PASSWORD;
}

export function createDatabaseKeyProvider(
	userDataPath: string,
	osCrypto: OsCryptoGate,
): DatabaseKeyProvider {
	const filePath = databaseKeyPath(userDataPath);

	function hasBlob(): boolean {
		return fs.existsSync(filePath);
	}

	function keyStorage(): KeyStorageKind {
		return usesPasswordWrap(osCrypto) ? "insecure_os_backend" : "os_secure";
	}

	function deleteBlob(): void {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	}

	async function persistKey(
		rawKey: Buffer,
		vaultPassword?: string,
	): Promise<void> {
		if (usesPasswordWrap(osCrypto)) {
			const backend = osCrypto.getLinuxStorageBackend();
			console.warn(
				`[db-encryption] backend=${backend ?? "unknown"}; wrapping database key with vault password`,
			);
			if (!vaultPassword) {
				throw new DatabaseEncryptionError(
					KeyStorageUnavailableErrorCode,
					"A vault password is required to protect the database key on this Linux session.",
				);
			}
			const payload = await wrapWithPassword(rawKey, vaultPassword);
			writeBlobAtomic(filePath, encodeBlob(KIND_PASSWORD, payload));
			return;
		}

		const encrypted = await osCrypto.encryptString(rawKey.toString("hex"));
		writeBlobAtomic(filePath, encodeBlob(KIND_OS, encrypted.encrypted));
	}

	async function loadKey(vaultPassword?: string): Promise<Buffer> {
		if (!hasBlob()) {
			throw new DatabaseEncryptionError(
				DatabaseKeyMissingErrorCode,
				"Moat cannot open the local vault key for this database. The data file was left untouched.",
			);
		}
		const blob = fs.readFileSync(filePath);
		const { kind, payload } = parseBlob(blob);

		if (kind === KIND_PASSWORD) {
			if (!vaultPassword) {
				throw new DatabaseEncryptionError(
					KeyUnwrapFailedErrorCode,
					"Moat cannot open the local vault key for this database. The data file was left untouched.",
				);
			}
			return unwrapWithPassword(payload, vaultPassword);
		}

		let decrypted: {
			decrypted: string;
			shouldReEncrypt: boolean;
			isTemporarilyUnavailable: boolean;
		};
		try {
			decrypted = await osCrypto.decryptString(payload);
		} catch {
			throw new DatabaseEncryptionError(
				KeyUnwrapFailedErrorCode,
				"Moat cannot open the local vault key for this database. The data file was left untouched.",
			);
		}
		if (decrypted.isTemporarilyUnavailable) {
			throw new DatabaseEncryptionError(
				KeyStorageUnavailableErrorCode,
				"This device’s secure storage is locked or unavailable.",
			);
		}
		const rawKey = Buffer.from(decrypted.decrypted, "hex");
		if (rawKey.length !== SQLCIPHER_KEY_BYTES) {
			throw new DatabaseEncryptionError(
				KeyUnwrapFailedErrorCode,
				"Moat cannot open the local vault key for this database. The data file was left untouched.",
			);
		}
		if (decrypted.shouldReEncrypt) {
			await persistKey(rawKey, vaultPassword);
		}
		return rawKey;
	}

	return {
		hasBlob,
		keyStorage,
		deleteBlob,
		async getOrCreateKey(options) {
			if (hasBlob()) {
				return loadKey(options.vaultPassword);
			}
			if (!options.createIfMissing) {
				throw new DatabaseEncryptionError(
					DatabaseKeyMissingErrorCode,
					"Moat cannot open the local vault key for this database. The data file was left untouched.",
				);
			}
			const rawKey = randomBytes(SQLCIPHER_KEY_BYTES);
			await persistKey(rawKey, options.vaultPassword);
			return loadKey(options.vaultPassword);
		},
		async rewrapIfPasswordWrapped(password: string) {
			if (!hasBlob()) return;
			const blob = fs.readFileSync(filePath);
			const { kind } = parseBlob(blob);
			if (kind !== KIND_PASSWORD) return;
			const rawKey = await loadKey(password);
			await persistKey(rawKey, password);
		},
	};
}
