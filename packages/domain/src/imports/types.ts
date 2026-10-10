export type CsvColumnMapping = {
	date: string;
	amount: string;
	description?: string;
	type?: string;
	category?: string;
	memo?: string;
	account?: string;
};

export type ParsedCsvRow = {
	date: string;
	amount: string;
	description: string;
	type?: string;
	category?: string;
	memo?: string;
	account?: string;
};

export type NormalizedImportRow = {
	/** Stable hash for row identity in a preview DTO — not the DB uniqueness key. */
	dedupKey: string;
	dedupeFingerprint?: string;
	date: Date;
	amount: number;
	type: "INCOME" | "EXPENSE";
	description: string;
	originalDescription?: string;
	category?: string;
	account?: string;
};

export type ImportPreview = {
	rows: NormalizedImportRow[];
	duplicateCount: number;
	newCount: number;
	headers: string[];
};

export type ImportResult = {
	imported: number;
	skipped: number;
	transactionIds: string[];
};

export const MAX_TRANSACTION_IMPORT_ROWS = 5000;
export const MAX_CSV_TEXT_CHARS = 2_000_000;
export const IMPORT_PREVIEW_SAMPLE_SIZE = 10;
export const HUMAN_IMPORT_PREVIEW_SAMPLE_SIZE = 100;
export const IMPORT_UNCATEGORIZED_WARNING =
	"These transactions will be uncategorized. Map a Category column, or categorize them in the CSV before uploading.";

export type ImportJsonRow = {
	date: Date | string;
	amount: number;
	type?: "INCOME" | "EXPENSE" | string;
	description?: string;
	originalDescription?: string;
	category?: string;
	account?: string;
	dedupKey?: string;
};

export type TransactionImportSource = {
	accountId?: string;
	rows?: ImportJsonRow[];
	csvText?: string;
	mapping?: CsvColumnMapping;
	templateId?: string;
	headers?: string[];
	rawRows?: Array<Record<string, string | number>>;
};

export type TransactionImportSampleRow = {
	date: string;
	amount: number;
	type: "INCOME" | "EXPENSE";
	description: string;
	category?: string;
};

export type TransactionImportPreview = ImportPreview & {
	invalidCount: number;
	sample: NormalizedImportRow[];
	categoryColumnMapped: boolean;
	uncategorizedWarning: string | null;
};

export type TransactionImportCommitResult =
	| {
			status: "applied";
			imported: number;
			skipped: number;
			newCount: number;
			duplicateCount: number;
			invalidCount: number;
			transactionIds: string[];
	  }
	| {
			status: "confirmation_mismatch";
			actualNewCount: number;
			duplicateCount: number;
			invalidCount: number;
	  };
