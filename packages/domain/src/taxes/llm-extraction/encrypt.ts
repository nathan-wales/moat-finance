import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { TAX_LLM_DEFAULT_KEY_VERSION } from "./constants";
import {
	assertQueueMessageSize,
	type TaxLlmPlaintextPayloadV1,
	TaxLlmPlaintextPayloadV1Schema,
	type TaxLlmQueueMessageV1,
} from "./queue-message";

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class TaxLlmDecryptionError extends Error {
	readonly code = "DECRYPTION_FAILED" as const;
	constructor() {
		super("DECRYPTION_FAILED");
		this.name = "TaxLlmDecryptionError";
	}
}

export type TaxLlmKeyMaterial = {
	keyVersion: string;
	key: Buffer;
};

export type TaxLlmKeyResolver = {
	activeKey(): TaxLlmKeyMaterial;
	keyForVersion(keyVersion: string): TaxLlmKeyMaterial;
};

export function parseTaxLlmKeyBase64(raw: string, keyVersion: string): Buffer {
	const key = Buffer.from(raw, "base64");
	if (key.length !== KEY_LENGTH) {
		throw new Error(
			`Tax LLM encryption key ${keyVersion} must be 32 bytes (Base64 of 32 random bytes)`,
		);
	}
	return key;
}

export function createEnvTaxLlmKeyResolver(
	env: Record<string, string | undefined> = process.env,
): TaxLlmKeyResolver {
	const activeVersion =
		env.TAX_LLM_ENCRYPTION_KEY_VERSION?.trim() || TAX_LLM_DEFAULT_KEY_VERSION;
	const keys = new Map<string, Buffer>();
	for (const [name, value] of Object.entries(env)) {
		if (name === "TAX_LLM_ENCRYPTION_KEY_VERSION") continue;
		const match = /^TAX_LLM_ENCRYPTION_KEY_(.+)$/.exec(name);
		if (!match || !value?.trim()) continue;
		const version = match[1];
		if (!version || keys.has(version)) continue;
		keys.set(version, parseTaxLlmKeyBase64(value.trim(), version));
	}
	if (!keys.has(activeVersion)) {
		const raw = env[`TAX_LLM_ENCRYPTION_KEY_${activeVersion}`]?.trim();
		if (raw) {
			keys.set(activeVersion, parseTaxLlmKeyBase64(raw, activeVersion));
		}
	}
	if (keys.size === 0) {
		throw new Error("No TAX_LLM_ENCRYPTION_KEY_* configured");
	}

	return {
		activeKey() {
			return material(activeVersion);
		},
		keyForVersion(keyVersion: string) {
			return material(keyVersion);
		},
	};

	function material(keyVersion: string): TaxLlmKeyMaterial {
		const key = keys.get(keyVersion);
		if (!key) {
			throw new Error(`Tax LLM encryption key version is not configured`);
		}
		return { keyVersion, key };
	}
}

export function taxLlmEncryptionAad(input: {
	jobId: string;
	documentType: string;
	schemaVersion: string;
}): Buffer {
	return Buffer.from(
		`${input.jobId}:${input.documentType}:${input.schemaVersion}`,
		"utf8",
	);
}

export function encryptTaxExtractionPayload(input: {
	jobId: string;
	documentType: "W2";
	schemaVersion: string;
	plaintext: TaxLlmPlaintextPayloadV1;
	keys: TaxLlmKeyResolver;
}): TaxLlmQueueMessageV1 {
	const parsedPlaintext = TaxLlmPlaintextPayloadV1Schema.parse(input.plaintext);
	const { key, keyVersion } = input.keys.activeKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	const aad = taxLlmEncryptionAad({
		jobId: input.jobId,
		documentType: input.documentType,
		schemaVersion: input.schemaVersion,
	});
	cipher.setAAD(aad);
	const ciphertext = Buffer.concat([
		cipher.update(JSON.stringify(parsedPlaintext), "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	const message: TaxLlmQueueMessageV1 = {
		version: 1,
		jobId: input.jobId,
		documentType: input.documentType,
		schemaVersion: input.schemaVersion,
		encryption: {
			algorithm: ALGORITHM,
			keyVersion,
			iv: iv.toString("base64"),
			authTag: authTag.toString("base64"),
			ciphertext: ciphertext.toString("base64"),
		},
	};
	assertQueueMessageSize(message);
	return message;
}

function decodeAesGcm(input: {
	key: Buffer;
	iv: string;
	authTag: string;
	ciphertext: string;
	aad: Buffer;
}): Buffer {
	const iv = Buffer.from(input.iv, "base64");
	const authTag = Buffer.from(input.authTag, "base64");
	const ciphertext = Buffer.from(input.ciphertext, "base64");
	if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
		throw new TaxLlmDecryptionError();
	}
	try {
		const decipher = createDecipheriv(ALGORITHM, input.key, iv, {
			authTagLength: AUTH_TAG_LENGTH,
		});
		decipher.setAAD(input.aad);
		decipher.setAuthTag(authTag);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	} catch {
		throw new TaxLlmDecryptionError();
	}
}

export function decryptTaxExtractionPayload(input: {
	message: TaxLlmQueueMessageV1;
	keys: TaxLlmKeyResolver;
}): TaxLlmPlaintextPayloadV1 {
	let key: Buffer;
	try {
		({ key } = input.keys.keyForVersion(input.message.encryption.keyVersion));
	} catch {
		throw new TaxLlmDecryptionError();
	}
	const decrypted = decodeAesGcm({
		key,
		iv: input.message.encryption.iv,
		authTag: input.message.encryption.authTag,
		ciphertext: input.message.encryption.ciphertext,
		aad: taxLlmEncryptionAad({
			jobId: input.message.jobId,
			documentType: input.message.documentType,
			schemaVersion: input.message.schemaVersion,
		}),
	});
	try {
		return TaxLlmPlaintextPayloadV1Schema.parse(
			JSON.parse(decrypted.toString("utf8")),
		);
	} catch {
		throw new TaxLlmDecryptionError();
	}
}

export function encryptJsonBytes(input: {
	jobId: string;
	documentType: "W2";
	schemaVersion: string;
	value: unknown;
	keys: TaxLlmKeyResolver;
}): {
	algorithm: "aes-256-gcm";
	keyVersion: string;
	iv: string;
	authTag: string;
	ciphertext: string;
} {
	const { key, keyVersion } = input.keys.activeKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	cipher.setAAD(
		taxLlmEncryptionAad({
			jobId: input.jobId,
			documentType: input.documentType,
			schemaVersion: input.schemaVersion,
		}),
	);
	const ciphertext = Buffer.concat([
		cipher.update(JSON.stringify(input.value), "utf8"),
		cipher.final(),
	]);
	return {
		algorithm: ALGORITHM,
		keyVersion,
		iv: iv.toString("base64"),
		authTag: cipher.getAuthTag().toString("base64"),
		ciphertext: ciphertext.toString("base64"),
	};
}

export function decryptJsonBytes(input: {
	jobId: string;
	documentType: string;
	schemaVersion: string;
	encryption: {
		keyVersion: string;
		iv: string;
		authTag: string;
		ciphertext: string;
	};
	keys: TaxLlmKeyResolver;
}): unknown {
	let key: Buffer;
	try {
		({ key } = input.keys.keyForVersion(input.encryption.keyVersion));
	} catch {
		throw new TaxLlmDecryptionError();
	}
	const decrypted = decodeAesGcm({
		key,
		iv: input.encryption.iv,
		authTag: input.encryption.authTag,
		ciphertext: input.encryption.ciphertext,
		aad: taxLlmEncryptionAad({
			jobId: input.jobId,
			documentType: input.documentType,
			schemaVersion: input.schemaVersion,
		}),
	});
	try {
		return JSON.parse(decrypted.toString("utf8"));
	} catch {
		throw new TaxLlmDecryptionError();
	}
}
