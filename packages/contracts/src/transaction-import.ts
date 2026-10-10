import { z } from "zod";

export const MAX_TRANSACTION_IMPORT_ROWS = 5000;
export const MAX_CSV_TEXT_CHARS = 2_000_000;
export const IMPORT_PREVIEW_SAMPLE_SIZE = 10;
export const HUMAN_IMPORT_PREVIEW_SAMPLE_SIZE = 100;
export const IMPORT_UNCATEGORIZED_WARNING =
	"These transactions will be uncategorized. Map a Category column, or categorize them in the CSV before uploading.";

export const csvColumnMappingSchema = z
	.object({
		date: z.string().min(1).describe("Header name for the date column"),
		amount: z.string().min(1).describe("Header name for the amount column"),
		description: z.string().min(1).optional(),
		type: z.string().min(1).optional(),
		category: z.string().min(1).optional(),
		memo: z
			.string()
			.min(1)
			.optional()
			.describe("Header name for the memo / original description column"),
		account: z.string().min(1).optional(),
	})
	.strict();

export const transactionImportJsonRowSchema = z
	.object({
		date: z
			.union([z.string().min(1), z.coerce.date()])
			.describe("Transaction date (ISO yyyy-MM-dd preferred)"),
		amount: z.number().finite().describe("Signed or absolute amount"),
		type: z.enum(["INCOME", "EXPENSE"]).optional(),
		description: z.string().max(500).optional(),
		originalDescription: z.string().max(500).optional(),
		category: z.string().max(100).optional(),
		account: z.string().max(120).optional(),
		dedupKey: z.string().min(1).max(64).optional(),
	})
	.strict();

export const transactionImportSampleRowSchema = z
	.object({
		date: z.string(),
		amount: z.number(),
		type: z.enum(["INCOME", "EXPENSE"]),
		description: z.string(),
		category: z.string().optional(),
	})
	.strict();

const transactionImportSourceFields = {
	accountId: z
		.string()
		.min(1)
		.optional()
		.describe("Optional account id to assign imported rows"),
	rows: z
		.array(transactionImportJsonRowSchema)
		.max(MAX_TRANSACTION_IMPORT_ROWS)
		.optional()
		.describe("Normalized JSON rows (no CSV required)"),
	csvText: z
		.string()
		.min(1)
		.max(MAX_CSV_TEXT_CHARS)
		.optional()
		.describe("Raw CSV text; requires mapping or templateId"),
	mapping: csvColumnMappingSchema
		.optional()
		.describe("Column mapping for csvText, filePath, or rawRows"),
	templateId: z
		.string()
		.min(1)
		.optional()
		.describe("Saved mapping template id; XOR with mapping for CSV sources"),
	filePath: z
		.string()
		.min(1)
		.max(4096)
		.optional()
		.describe("Absolute .csv path; desktop local MCP/IPC only"),
	headers: z
		.array(z.string().min(1).max(80))
		.max(50)
		.optional()
		.describe("Optional header names for a mapping draft"),
	rawRows: z
		.array(z.record(z.string(), z.union([z.string(), z.number()])))
		.max(MAX_TRANSACTION_IMPORT_ROWS)
		.optional()
		.describe("Keyed objects plus mapping (mapping draft; no CSV file)"),
};

function hasColumnSpec(value: {
	mapping?: unknown;
	templateId?: string;
}): boolean {
	return Boolean(value.mapping) !== Boolean(value.templateId);
}

function refineTransactionImportSource(
	value: {
		rows?: unknown;
		csvText?: string;
		mapping?: unknown;
		templateId?: string;
		filePath?: string;
		rawRows?: unknown;
	},
	context: z.RefinementCtx,
) {
	if (value.rows !== undefined && (value.templateId || value.filePath)) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "JSON rows cannot include templateId or filePath",
		});
		return;
	}

	const hasRows = value.rows !== undefined;
	const hasMap = hasColumnSpec(value);
	const hasCsv = Boolean(value.csvText) && hasMap;
	const hasDraft = Boolean(value.rawRows) && hasMap;
	const hasFile = Boolean(value.filePath) && hasMap;
	const count =
		Number(hasRows) + Number(hasCsv) + Number(hasDraft) + Number(hasFile);
	if (count !== 1) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message:
				"Provide exactly one of rows, csvText, rawRows, or filePath with mapping or templateId",
		});
	}
}

export const previewTransactionImportInputSchema = z
	.object({
		...transactionImportSourceFields,
		sampleSize: z.number().int().min(1).max(100).optional(),
		sampleOffset: z
			.number()
			.int()
			.min(0)
			.max(MAX_TRANSACTION_IMPORT_ROWS)
			.optional(),
	})
	.strict()
	.superRefine(refineTransactionImportSource);

export const commitTransactionImportInputSchema = z
	.object({
		...transactionImportSourceFields,
		confirmed: z
			.literal(true)
			.describe("Must be true after reviewing the preview"),
		confirmedNewCount: z
			.number()
			.int()
			.min(0)
			.max(MAX_TRANSACTION_IMPORT_ROWS)
			.describe("Must match the live preview newCount"),
	})
	.strict()
	.superRefine(refineTransactionImportSource);

export const transactionImportPreviewResponseSchema = z.object({
	newCount: z.number().int().min(0),
	duplicateCount: z.number().int().min(0),
	invalidCount: z.number().int().min(0),
	headers: z.array(z.string()),
	sample: z.array(transactionImportSampleRowSchema),
	categoryColumnMapped: z.boolean(),
	uncategorizedWarning: z.string().nullable(),
});

export const transactionImportCommitAppliedSchema = z.object({
	status: z.literal("applied"),
	imported: z.number().int().min(0),
	skipped: z.number().int().min(0),
	newCount: z.number().int().min(0),
	duplicateCount: z.number().int().min(0),
	invalidCount: z.number().int().min(0),
});

export const transactionImportCommitMismatchSchema = z.object({
	status: z.literal("confirmation_mismatch"),
	actualNewCount: z.number().int().min(0),
	duplicateCount: z.number().int().min(0),
	invalidCount: z.number().int().min(0),
});

export const transactionImportCommitResponseSchema = z.discriminatedUnion(
	"status",
	[transactionImportCommitAppliedSchema, transactionImportCommitMismatchSchema],
);

export type CsvColumnMapping = z.infer<typeof csvColumnMappingSchema>;
export type PreviewTransactionImportInput = z.infer<
	typeof previewTransactionImportInputSchema
>;
export type CommitTransactionImportInput = z.infer<
	typeof commitTransactionImportInputSchema
>;
export type TransactionImportSampleRow = z.infer<
	typeof transactionImportSampleRowSchema
>;
export type TransactionImportPreviewResponse = z.infer<
	typeof transactionImportPreviewResponseSchema
>;
export type TransactionImportCommitResponse = z.infer<
	typeof transactionImportCommitResponseSchema
>;
