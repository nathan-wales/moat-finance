import { z } from "zod";

export const TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;
export const TAX_CLOUD_MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const TAX_CLOUD_MAX_DOCUMENT_PAGES = 150;

export const TaxDocumentStorageSchema = z
	.object({
		usedBytes: z.number().int().nonnegative(),
		limitBytes: z.number().int().positive().nullable(),
	})
	.strict();
export type TaxDocumentStorage = z.infer<typeof TaxDocumentStorageSchema>;
