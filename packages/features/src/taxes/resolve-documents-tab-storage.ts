import {
	TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
	type TaxDocumentStorage,
} from "@moat/contracts";

export function resolveDocumentsTabStorage(input: {
	usedBytes: number;
	overviewStorage: TaxDocumentStorage | undefined;
	overviewSuccess: boolean;
	overviewFailed: boolean;
}): TaxDocumentStorage | undefined {
	if (input.overviewStorage) {
		return {
			usedBytes: input.usedBytes,
			limitBytes: input.overviewStorage.limitBytes,
		};
	}
	if (input.overviewFailed || input.overviewSuccess) {
		return {
			usedBytes: input.usedBytes,
			limitBytes: TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
		};
	}
	return undefined;
}
