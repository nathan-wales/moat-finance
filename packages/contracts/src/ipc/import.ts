import { z } from "zod";
import {
	commitTransactionImportInputSchema,
	csvColumnMappingSchema,
	previewTransactionImportInputSchema,
	transactionImportPreviewResponseSchema,
	type transactionImportSampleRowSchema,
} from "../transaction-import";

export const IMPORT_CHANNELS = {
	previewCsv: "import:previewCsv",
	commitCsv: "import:commitCsv",
	detectColumns: "import:detectColumns",
	listTemplates: "import:listTemplates",
	createTemplate: "import:createTemplate",
	updateTemplate: "import:updateTemplate",
	deleteTemplate: "import:deleteTemplate",
} as const;

export const CsvColumnMappingSchema = csvColumnMappingSchema;
export const PreviewCsvInputSchema = previewTransactionImportInputSchema;
export const CommitImportInputSchema = commitTransactionImportInputSchema;

export const NormalizedImportRowSchema = z.object({
	dedupKey: z.string(),
	date: z.coerce.date(),
	amount: z.number(),
	type: z.enum(["INCOME", "EXPENSE"]),
	description: z.string(),
	category: z.string().optional(),
	account: z.string().optional(),
	dedupeFingerprint: z.string().optional(),
});

export const ImportPreviewResponseSchema =
	transactionImportPreviewResponseSchema;

export const ImportResultSchema = z.object({
	imported: z.number(),
	skipped: z.number(),
	newCount: z.number().optional(),
	duplicateCount: z.number().optional(),
	invalidCount: z.number().optional(),
	status: z.enum(["applied", "confirmation_mismatch"]).optional(),
	actualNewCount: z.number().optional(),
});

export const DetectColumnsInputSchema = z.object({
	headers: z.array(z.string()),
});

export type IpcCsvColumnMapping = z.infer<typeof CsvColumnMappingSchema>;
export type IpcImportPreviewResponse = z.infer<
	typeof ImportPreviewResponseSchema
>;
export type IpcNormalizedImportRow = z.infer<typeof NormalizedImportRowSchema>;
export type IpcImportResult = z.infer<typeof ImportResultSchema>;
export type IpcImportSampleRow = z.infer<
	typeof transactionImportSampleRowSchema
>;
