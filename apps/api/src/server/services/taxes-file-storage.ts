import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type { FileStorageProvider } from "@moat/domain";
import { logger } from "~/lib/logger";
import { wrapTaxFileStorageWithEncryption } from "./tax-document-encryption";

export type TaxR2Config = {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
};

export type TaxR2ObjectStore = {
	putObject(input: {
		key: string;
		bytes: Uint8Array;
		mimeType: string;
	}): Promise<void>;
	getObject(key: string): Promise<{ bytes: Uint8Array; mimeType: string }>;
	deleteObject(key: string): Promise<void>;
};

type TaxStorageEnv = Record<string, string | undefined>;

export function readTaxR2Config(
	env: TaxStorageEnv = process.env,
): TaxR2Config | null {
	const accountId = env.TAX_R2_ACCOUNT_ID?.trim();
	const accessKeyId = env.TAX_R2_ACCESS_KEY_ID?.trim();
	const secretAccessKey = env.TAX_R2_SECRET_ACCESS_KEY?.trim();
	const bucket = env.TAX_R2_BUCKET?.trim();
	if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
		return null;
	}
	return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function createTaxFileStorage(
	env: TaxStorageEnv = process.env,
	deps: { createR2Client?: (config: TaxR2Config) => TaxR2ObjectStore } = {},
): FileStorageProvider {
	const config = readTaxR2Config(env);
	if (config) {
		const createClient = deps.createR2Client ?? createS3R2ObjectStore;
		return maybeEncrypt(createR2TaxFileStorage(createClient(config)), env);
	}
	if (env.NODE_ENV === "production") {
		throw new Error("Tax file storage is not configured");
	}
	return maybeEncrypt(
		createLocalDirectoryTaxFileStorage(
			env.TAX_FILE_STORAGE_DIR ?? "/tmp/moat-tax-files",
		),
		env,
	);
}

function maybeEncrypt(
	storage: FileStorageProvider,
	env: TaxStorageEnv,
): FileStorageProvider {
	const nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV;
	const key = env.ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
	if (nodeEnv === "production" && !key) {
		throw new Error("Tax file encryption is not configured");
	}
	if (!key) {
		return storage;
	}
	return wrapTaxFileStorageWithEncryption(storage);
}

export function createS3R2ObjectStore(config: TaxR2Config): TaxR2ObjectStore {
	const client = new S3Client({
		region: "auto",
		endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
		requestChecksumCalculation: "WHEN_REQUIRED",
		responseChecksumValidation: "WHEN_REQUIRED",
	});

	return {
		async putObject(input) {
			await client.send(
				new PutObjectCommand({
					Bucket: config.bucket,
					Key: input.key,
					Body: Buffer.from(input.bytes),
					ContentType: input.mimeType,
				}),
			);
		},
		async getObject(key) {
			const result = await client.send(
				new GetObjectCommand({
					Bucket: config.bucket,
					Key: key,
				}),
			);
			if (!result.Body) {
				throw new Error("Tax file not found");
			}
			return {
				bytes: await result.Body.transformToByteArray(),
				mimeType: result.ContentType ?? "application/octet-stream",
			};
		},
		async deleteObject(key) {
			await client.send(
				new DeleteObjectCommand({
					Bucket: config.bucket,
					Key: key,
				}),
			);
		},
	};
}

function createR2TaxFileStorage(store: TaxR2ObjectStore): FileStorageProvider {
	return {
		async put(input) {
			try {
				await store.putObject({
					key: input.key,
					bytes: input.bytes,
					mimeType: input.mimeType,
				});
			} catch {
				throw new Error("Tax file upload failed");
			}
			return { key: input.key };
		},
		async get(key) {
			try {
				return await store.getObject(key);
			} catch {
				throw new Error("Tax file not found");
			}
		},
		async delete(key) {
			try {
				await store.deleteObject(key);
			} catch (error) {
				logger.error("tax_storage_delete_failed", {
					operation: "tax_storage_delete",
					errorName: error instanceof Error ? error.name : "unknown",
				});
			}
		},
	};
}

function createLocalDirectoryTaxFileStorage(root: string): FileStorageProvider {
	return {
		async put(input) {
			const filePath = path.join(root, input.key);
			await mkdir(path.dirname(filePath), { recursive: true });
			await writeFile(filePath, input.bytes);
			await writeFile(`${filePath}.mime`, input.mimeType, "utf8");
			return { key: input.key };
		},
		async get(key) {
			const filePath = path.join(root, key);
			const bytes = new Uint8Array(await readFile(filePath));
			const mimeType = await readFile(`${filePath}.mime`, "utf8").catch(
				() => "application/octet-stream",
			);
			return { bytes, mimeType };
		},
		async delete(key) {
			const filePath = path.join(root, key);
			await rm(filePath, { force: true });
			await rm(`${filePath}.mime`, { force: true });
		},
	};
}
