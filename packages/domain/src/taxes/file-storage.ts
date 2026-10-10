export type FileStoragePutInput = {
	key: string;
	bytes: Uint8Array;
	mimeType: string;
	visibility: "private";
};

export interface FileStorageProvider {
	put(input: FileStoragePutInput): Promise<{ key: string }>;
	get(key: string): Promise<{ bytes: Uint8Array; mimeType: string }>;
	delete(key: string): Promise<void>;
}

export function taxOriginalStorageKey(input: {
	userId: string;
	taxYear: number;
	documentId: string;
}): string {
	return `taxes/${input.userId}/${input.taxYear}/${input.documentId}/original`;
}

export function taxParsedStorageKey(input: {
	userId: string;
	taxYear: number;
	documentId: string;
}): string {
	return `taxes/${input.userId}/${input.taxYear}/${input.documentId}/parsed.json`;
}

export class MemoryFileStorage implements FileStorageProvider {
	private readonly files = new Map<
		string,
		{ bytes: Uint8Array; mimeType: string }
	>();

	async put(input: FileStoragePutInput): Promise<{ key: string }> {
		this.files.set(input.key, {
			bytes: input.bytes,
			mimeType: input.mimeType,
		});
		return { key: input.key };
	}

	async get(key: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
		const file = this.files.get(key);
		if (!file) {
			throw new Error("Tax file not found");
		}
		return file;
	}

	async delete(key: string): Promise<void> {
		this.files.delete(key);
	}
}
