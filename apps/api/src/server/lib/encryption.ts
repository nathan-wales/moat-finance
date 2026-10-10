/**
 * AES-256-GCM encryption utility for sensitive data (Plaid tokens, 2FA secrets, etc.).
 * Server-side only — never import from client code.
 *
 * Envelope format (v1):
 *   v1:<keyId>:<iv>:<authTag>:<ciphertext>   (all hex encoded, colon-delimited)
 *
 * Legacy format (v0 — produced before key versioning):
 *   <iv>:<authTag>:<ciphertext>
 *
 * New writes always use the v1 envelope. Decryption handles both formats for
 * backward compatibility with existing encrypted values.
 *
 * Key management:
 * - Active key is determined by ENCRYPTION_KEY_ID (default: "default").
 * - Additional keys can be provided as ENCRYPTION_KEY_<id>=<hex> for rotation support.
 * - Example: ENCRYPTION_KEY_v2=<new-hex-key>, then set ENCRYPTION_KEY_ID=v2
 *   New writes use v2; decryption still tries the matching key per stored keyId.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { logger } from "~/lib/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

const CURRENT_FORMAT_PREFIX = "v1";
const LEGACY_FORMAT_PARTS = 3; // iv:authTag:ciphertext

/**
 * Resolve the active key ID from env.
 * Defaults to "default" for backward compatibility.
 */
function getActiveKeyId(): string {
	return process.env.ENCRYPTION_KEY_ID ?? "default";
}

/**
 * Load a key by ID.
 * - If keyId is "default", read ENCRYPTION_KEY.
 * - Otherwise read ENCRYPTION_KEY_<keyId>.
 * - Throws if the key is absent or malformed.
 */
function loadKey(keyId: string): Buffer {
	const envVar =
		keyId === "default" ? "ENCRYPTION_KEY" : `ENCRYPTION_KEY_${keyId}`;
	const raw = process.env[envVar];

	if (!raw) {
		throw new Error(
			`Encryption key not found: ${envVar}. ` +
				`Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
		);
	}

	const buf = Buffer.from(raw, "hex");
	if (buf.length !== 32) {
		throw new Error(
			`${envVar} must be a 64-character hex string (32 bytes). Got ${buf.length * 2} hex chars.`,
		);
	}
	return buf;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Returns a versioned envelope string:
 *   v1:<keyId>:<iv>:<authTag>:<ciphertext>   (all hex encoded)
 */
export function encrypt(text: string): string {
	const keyId = getActiveKeyId();
	const key = loadKey(keyId);
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	const encrypted = Buffer.concat([
		cipher.update(text, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return [
		CURRENT_FORMAT_PREFIX,
		keyId,
		iv.toString("hex"),
		authTag.toString("hex"),
		encrypted.toString("hex"),
	].join(":");
}

/**
 * Decrypts a payload produced by `encrypt`.
 *
 * Supports both the v1 versioned envelope and the legacy 3-part format.
 * Throws on tampered ciphertext or wrong key.
 */
export function decrypt(payload: string): string {
	try {
		const parts = payload.split(":");

		// Determine format by part count / prefix
		if (parts[0] === CURRENT_FORMAT_PREFIX && parts.length === 5) {
			// v1 versioned format: v1:<keyId>:<iv>:<authTag>:<ciphertext>
			const [, keyId, ivHex, authTagHex, encryptedHex] = parts as [
				string,
				string,
				string,
				string,
				string,
			];
			const key = loadKey(keyId);
			return decryptParts(key, ivHex, authTagHex, encryptedHex);
		}

		if (parts.length === LEGACY_FORMAT_PARTS) {
			// Legacy format: <iv>:<authTag>:<ciphertext> — use the default key
			const [ivHex, authTagHex, encryptedHex] = parts as [
				string,
				string,
				string,
			];
			const key = loadKey("default");
			return decryptParts(key, ivHex, authTagHex, encryptedHex);
		}

		throw new Error(
			`Unrecognized encrypted payload format (${parts.length} parts, prefix="${parts[0]}").`,
		);
	} catch (error) {
		logger.error("Decryption failed", {
			feature: "encryption",
			operation: "decrypt",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
			// Never log ciphertext, plaintext, or key material
		});
		throw error;
	}
}

function decryptParts(
	key: Buffer,
	ivHex: string,
	authTagHex: string,
	encryptedHex: string,
): string {
	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const encrypted = Buffer.from(encryptedHex, "hex");

	const decipher = createDecipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(encrypted),
		decipher.final(),
	]);
	return decrypted.toString("utf8");
}

/**
 * Returns the key ID embedded in an encrypted payload, or "default" for legacy payloads.
 * Useful for identifying which key a stored value was encrypted with.
 */
export function getPayloadKeyId(payload: string): string {
	const parts = payload.split(":");
	if (parts[0] === CURRENT_FORMAT_PREFIX && parts.length === 5) {
		return parts[1] ?? "default";
	}
	return "default";
}

/**
 * Returns true if a payload was encrypted with the current active key.
 * Use this to identify values that need re-encryption during a rotation.
 */
export function isEncryptedWithActiveKey(payload: string): boolean {
	return getPayloadKeyId(payload) === getActiveKeyId();
}

const BINARY_ENVELOPE_MAGIC = Buffer.from("MOAT1");
const BINARY_ENVELOPE_VERSION = 1;
const DEK_LENGTH = 32;

export function isBinaryEnvelope(bytes: Uint8Array): boolean {
	if (bytes.byteLength < BINARY_ENVELOPE_MAGIC.length) return false;
	return Buffer.from(bytes.subarray(0, BINARY_ENVELOPE_MAGIC.length)).equals(
		BINARY_ENVELOPE_MAGIC,
	);
}

export function encryptBytes(plain: Uint8Array): Uint8Array {
	const keyId = getActiveKeyId();
	const kek = loadKey(keyId);
	const dek = randomBytes(DEK_LENGTH);

	const dekIv = randomBytes(IV_LENGTH);
	const dekCipher = createCipheriv(ALGORITHM, kek, dekIv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	const dekCiphertext = Buffer.concat([
		dekCipher.update(dek),
		dekCipher.final(),
	]);
	const dekTag = dekCipher.getAuthTag();

	const fileIv = randomBytes(IV_LENGTH);
	const fileCipher = createCipheriv(ALGORITHM, dek, fileIv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	const fileCiphertext = Buffer.concat([
		fileCipher.update(Buffer.from(plain)),
		fileCipher.final(),
	]);
	const fileTag = fileCipher.getAuthTag();

	const keyIdBuf = Buffer.from(keyId, "utf8");
	return new Uint8Array(
		Buffer.concat([
			BINARY_ENVELOPE_MAGIC,
			Buffer.from([BINARY_ENVELOPE_VERSION]),
			Buffer.from([keyIdBuf.length]),
			keyIdBuf,
			dekIv,
			dekTag,
			dekCiphertext,
			fileIv,
			fileTag,
			fileCiphertext,
		]),
	);
}

export function decryptBytes(payload: Uint8Array): Uint8Array {
	try {
		if (!isBinaryEnvelope(payload)) {
			throw new Error("Unrecognized binary envelope");
		}
		let offset = BINARY_ENVELOPE_MAGIC.length;
		const version = payload[offset];
		offset += 1;
		if (version !== BINARY_ENVELOPE_VERSION) {
			throw new Error("Unsupported binary envelope version");
		}
		const keyIdLen = payload[offset];
		offset += 1;
		if (keyIdLen === undefined) {
			throw new Error("Malformed binary envelope");
		}
		const keyId = Buffer.from(
			payload.subarray(offset, offset + keyIdLen),
		).toString("utf8");
		offset += keyIdLen;
		const kek = loadKey(keyId);

		const dekIv = Buffer.from(payload.subarray(offset, offset + IV_LENGTH));
		offset += IV_LENGTH;
		const dekTag = Buffer.from(
			payload.subarray(offset, offset + AUTH_TAG_LENGTH),
		);
		offset += AUTH_TAG_LENGTH;
		const dekCiphertext = Buffer.from(
			payload.subarray(offset, offset + DEK_LENGTH),
		);
		offset += DEK_LENGTH;

		const dekDecipher = createDecipheriv(ALGORITHM, kek, dekIv, {
			authTagLength: AUTH_TAG_LENGTH,
		});
		dekDecipher.setAuthTag(dekTag);
		const dek = Buffer.concat([
			dekDecipher.update(dekCiphertext),
			dekDecipher.final(),
		]);

		const fileIv = Buffer.from(payload.subarray(offset, offset + IV_LENGTH));
		offset += IV_LENGTH;
		const fileTag = Buffer.from(
			payload.subarray(offset, offset + AUTH_TAG_LENGTH),
		);
		offset += AUTH_TAG_LENGTH;
		const fileCiphertext = Buffer.from(payload.subarray(offset));

		const fileDecipher = createDecipheriv(ALGORITHM, dek, fileIv, {
			authTagLength: AUTH_TAG_LENGTH,
		});
		fileDecipher.setAuthTag(fileTag);
		return new Uint8Array(
			Buffer.concat([
				fileDecipher.update(fileCiphertext),
				fileDecipher.final(),
			]),
		);
	} catch (error) {
		logger.error("Binary decryption failed", {
			feature: "encryption",
			operation: "decryptBytes",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
