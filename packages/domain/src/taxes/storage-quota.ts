import {
	TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
	TAX_CLOUD_MAX_DOCUMENT_BYTES,
	TAX_CLOUD_MAX_DOCUMENT_PAGES,
} from "@moat/contracts";
import type { TaxDocumentRecord } from "@moat/data-access";

export {
	TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
	TAX_CLOUD_MAX_DOCUMENT_BYTES,
	TAX_CLOUD_MAX_DOCUMENT_PAGES,
};

export class TaxDocumentStorageLimitError extends Error {
	readonly code = "TAX_DOCUMENT_STORAGE_LIMIT";
	readonly usedBytes: number;
	readonly incomingBytes: number;
	readonly limitBytes: number;

	constructor(input: {
		usedBytes: number;
		incomingBytes: number;
		limitBytes: number;
	}) {
		super(
			`This upload would exceed the ${formatStorageLimit(input.limitBytes)} cloud storage limit for this tax year.`,
		);
		this.name = "TaxDocumentStorageLimitError";
		this.usedBytes = input.usedBytes;
		this.incomingBytes = input.incomingBytes;
		this.limitBytes = input.limitBytes;
	}
}

export function getTaxDocumentByteSize(
	record: Pick<TaxDocumentRecord, "metadata">,
): number {
	const value = record.metadata?.byteSize;
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		return 0;
	}
	return Math.trunc(value);
}

export function sumTaxDocumentStorageBytes(
	documents: Array<Pick<TaxDocumentRecord, "metadata">>,
): number {
	return documents.reduce(
		(sum, document) => sum + getTaxDocumentByteSize(document),
		0,
	);
}

export function taxDocumentMetadataWithByteSize(
	existing: Record<string, unknown> | null,
	byteSize: number,
	patch: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		...existing,
		...patch,
		byteSize,
	};
}

export function assertTaxDocumentStorageLimit(input: {
	usedBytes: number;
	incomingBytes: number;
	limitBytes: number | undefined;
}): void {
	if (input.limitBytes === undefined) return;
	if (input.usedBytes + input.incomingBytes <= input.limitBytes) return;
	throw new TaxDocumentStorageLimitError({
		usedBytes: input.usedBytes,
		incomingBytes: input.incomingBytes,
		limitBytes: input.limitBytes,
	});
}

export class TaxDocumentFileTooLargeError extends Error {
	readonly code = "TAX_DOCUMENT_FILE_TOO_LARGE";
	readonly byteSize: number;
	readonly limitBytes: number;

	constructor(input: { byteSize: number; limitBytes: number }) {
		super(
			`This file is ${formatStorageLimit(input.byteSize)}, which exceeds the ${formatStorageLimit(input.limitBytes)} per-file limit.`,
		);
		this.name = "TaxDocumentFileTooLargeError";
		this.byteSize = input.byteSize;
		this.limitBytes = input.limitBytes;
	}
}

export function assertTaxDocumentFileSizeLimit(input: {
	byteSize: number;
	limitBytes: number | undefined;
}): void {
	if (input.limitBytes === undefined) return;
	if (input.byteSize <= input.limitBytes) return;
	throw new TaxDocumentFileTooLargeError({
		byteSize: input.byteSize,
		limitBytes: input.limitBytes,
	});
}

function formatStorageLimit(bytes: number): string {
	return `${Math.round(bytes / (1024 * 1024))} MB`;
}
