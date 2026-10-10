import { randomUUID } from "node:crypto";
import type { AccountSummary, CreateTransactionInput } from "@moat/data-access";
import {
	createAccountFingerprint,
	createTransactionDedupeFingerprint,
} from "@moat/financial-data-providers";
import type { AppContext } from "../context";
import {
	computeImportDedupKey,
	importRowSignature,
	normalizeTransaction,
	parseImportDate,
} from "./normalizeTransaction";
import { mapKeyedRows, parseCsv } from "./parseCsv";
import type {
	CsvColumnMapping,
	ImportJsonRow,
	ImportPreview,
	ImportResult,
	NormalizedImportRow,
	ParsedCsvRow,
	TransactionImportCommitResult,
	TransactionImportPreview,
	TransactionImportSampleRow,
	TransactionImportSource,
} from "./types";
import {
	HUMAN_IMPORT_PREVIEW_SAMPLE_SIZE,
	IMPORT_PREVIEW_SAMPLE_SIZE,
	IMPORT_UNCATEGORIZED_WARNING,
	MAX_CSV_TEXT_CHARS,
	MAX_TRANSACTION_IMPORT_ROWS,
} from "./types";

export {
	HUMAN_IMPORT_PREVIEW_SAMPLE_SIZE,
	IMPORT_PREVIEW_SAMPLE_SIZE,
	IMPORT_UNCATEGORIZED_WARNING,
	MAX_CSV_TEXT_CHARS,
	MAX_TRANSACTION_IMPORT_ROWS,
} from "./types";

export class TransactionImportError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "TransactionImportError";
		this.code = code;
	}
}

function clampSampleSize(sampleSize: number | undefined): number {
	if (sampleSize === undefined) return IMPORT_PREVIEW_SAMPLE_SIZE;
	if (!Number.isFinite(sampleSize)) return IMPORT_PREVIEW_SAMPLE_SIZE;
	return Math.min(
		HUMAN_IMPORT_PREVIEW_SAMPLE_SIZE,
		Math.max(1, Math.trunc(sampleSize)),
	);
}

function clampSampleOffset(sampleOffset: number | undefined): number {
	if (sampleOffset === undefined || !Number.isFinite(sampleOffset)) return 0;
	return Math.min(
		MAX_TRANSACTION_IMPORT_ROWS,
		Math.max(0, Math.trunc(sampleOffset)),
	);
}

type PreviewSampleWindow = {
	sampleSize?: number;
	sampleOffset?: number;
};

function normalizeJsonImportRow(
	row: ImportJsonRow,
): NormalizedImportRow | null {
	const date = parseImportDate(row.date);
	if (!date) return null;
	if (typeof row.amount !== "number" || !Number.isFinite(row.amount)) {
		return null;
	}

	const amount = Math.abs(row.amount);
	let type: "INCOME" | "EXPENSE" = row.amount < 0 ? "EXPENSE" : "INCOME";
	if (row.type === "INCOME" || row.type === "EXPENSE") {
		type = row.type;
	} else if (row.type) {
		const parsed = normalizeTransaction({
			date: date.toISOString(),
			amount: String(row.amount),
			description: row.description ?? "",
			type: row.type,
			category: row.category,
			account: row.account,
		});
		if (parsed) type = parsed.type;
	}

	const description = row.description?.trim() || "Imported transaction";
	const originalDescription = row.originalDescription?.trim() || undefined;
	const dedupKey =
		row.dedupKey?.trim() ||
		computeImportDedupKey({ date, amount, description });

	return {
		dedupKey,
		date,
		amount,
		type,
		description,
		originalDescription,
		category: row.category?.trim() || undefined,
		account: row.account?.trim() || undefined,
	};
}

function countSourceShapes(input: TransactionImportSource): number {
	const hasMap = Boolean(input.mapping) !== Boolean(input.templateId);
	const hasRows = Array.isArray(input.rows);
	const hasCsv = Boolean(input.csvText) && hasMap;
	const hasDraft = Boolean(input.rawRows) && hasMap;
	return Number(hasRows) + Number(hasCsv) + Number(hasDraft);
}

export async function resolveImportSource(
	ctx: AppContext,
	input: TransactionImportSource,
): Promise<TransactionImportSource & { categoryColumnMapped: boolean }> {
	if (input.templateId && input.mapping) {
		throw new TransactionImportError(
			"INVALID_SOURCE",
			"Provide mapping or templateId, not both",
		);
	}

	let mapping = input.mapping;
	let accountId = input.accountId;

	if (input.templateId) {
		const repo = ctx.repositories.importMappingTemplates;
		if (!repo) {
			throw new TransactionImportError(
				"TEMPLATE_NOT_FOUND",
				"Import template not found",
			);
		}
		const template = await repo.findById({
			userId: ctx.userId,
			id: input.templateId,
		});
		if (!template) {
			throw new TransactionImportError(
				"TEMPLATE_NOT_FOUND",
				"Import template not found",
			);
		}
		mapping = {
			date: template.mapping.date,
			amount: template.mapping.amount,
			description: template.mapping.description,
			...(template.mapping.type ? { type: template.mapping.type } : {}),
			...(template.mapping.category
				? { category: template.mapping.category }
				: {}),
			...(template.mapping.memo ? { memo: template.mapping.memo } : {}),
		};
		if (!accountId && template.accountId) {
			accountId = template.accountId;
		}
	}

	const categoryColumnMapped = input.rows
		? input.rows.some((row) => Boolean(row.category?.toString().trim()))
		: Boolean(mapping?.category);

	return {
		accountId,
		rows: input.rows,
		csvText: input.csvText,
		mapping,
		headers: input.headers,
		rawRows: input.rawRows,
		categoryColumnMapped,
	};
}

function resolvedHeaders(
	input: TransactionImportSource,
	fallback: string[],
): string[] {
	if (input.headers && input.headers.length > 0) return input.headers;
	return fallback;
}

export function fingerprintImportRow(
	row: Pick<NormalizedImportRow, "date" | "amount" | "description">,
	account: AccountSummary | null,
	storedAccountFingerprint?: string | null,
): string {
	const date = row.date.toISOString().slice(0, 10);
	const accountFingerprint =
		storedAccountFingerprint ??
		(account
			? createAccountFingerprint({
					name: account.name,
					type: account.type,
					subtype: account.subtype,
					mask: account.mask,
					currency: account.currency ?? "USD",
				})
			: null);

	return createTransactionDedupeFingerprint({
		accountFingerprint,
		amount: row.amount,
		date,
		description: row.description,
		pending: false,
	});
}

export function formatImportSampleRow(
	row: NormalizedImportRow,
): TransactionImportSampleRow {
	return {
		date: row.date.toISOString().slice(0, 10),
		amount: row.amount,
		type: row.type,
		description: row.description,
		...(row.category ? { category: row.category } : {}),
	};
}

async function resolveImportAccount(
	ctx: AppContext,
	accountId: string | undefined,
): Promise<AccountSummary | null> {
	if (!accountId) return null;
	const accounts = await ctx.repositories.accounts.listAll({
		userId: ctx.userId,
	});
	const selected = accounts.find((account) => account.id === accountId);
	if (!selected) {
		throw new TransactionImportError("ACCOUNT_NOT_FOUND", "Account not found");
	}
	return selected;
}

export function resolveImportRows(input: TransactionImportSource): {
	headers: string[];
	normalized: NormalizedImportRow[];
	invalidCount: number;
} {
	if (countSourceShapes(input) !== 1) {
		throw new TransactionImportError(
			"INVALID_SOURCE",
			"Provide exactly one of rows, csvText+mapping, or rawRows+mapping",
		);
	}

	if (input.csvText && input.csvText.length > MAX_CSV_TEXT_CHARS) {
		throw new TransactionImportError(
			"PAYLOAD_TOO_LARGE",
			"CSV text exceeds the 2,000,000 character limit",
		);
	}

	let headers: string[] = [];
	let parsed: ParsedCsvRow[] = [];

	if (input.rows) {
		const normalizedFromJson: NormalizedImportRow[] = [];
		let invalidCount = 0;
		for (const row of input.rows) {
			const normalized = normalizeJsonImportRow(row);
			if (!normalized) {
				invalidCount += 1;
				continue;
			}
			normalizedFromJson.push(normalized);
		}
		if (
			normalizedFromJson.length + invalidCount >
			MAX_TRANSACTION_IMPORT_ROWS
		) {
			throw new TransactionImportError(
				"TOO_MANY_ROWS",
				`Import cannot exceed ${MAX_TRANSACTION_IMPORT_ROWS} rows`,
			);
		}
		return {
			headers: resolvedHeaders(input, []),
			normalized: normalizedFromJson,
			invalidCount,
		};
	}

	if (input.csvText && input.mapping) {
		const parsedCsv = parseCsv(input.csvText, input.mapping);
		headers = parsedCsv.headers;
		parsed = parsedCsv.rows;
	} else if (input.rawRows && input.mapping) {
		const mapped = mapKeyedRows(input.mapping, input.rawRows);
		headers = mapped.headers;
		parsed = mapped.rows;
	}

	if (parsed.length > MAX_TRANSACTION_IMPORT_ROWS) {
		throw new TransactionImportError(
			"TOO_MANY_ROWS",
			`Import cannot exceed ${MAX_TRANSACTION_IMPORT_ROWS} rows`,
		);
	}

	const normalized: NormalizedImportRow[] = [];
	let invalidCount = 0;
	for (const row of parsed) {
		const next = normalizeTransaction(row);
		if (!next) {
			invalidCount += 1;
			continue;
		}
		normalized.push(next);
	}

	return {
		headers: resolvedHeaders(input, headers),
		normalized,
		invalidCount,
	};
}

export async function previewNormalizedImport(
	ctx: AppContext,
	input: {
		headers: string[];
		normalized: NormalizedImportRow[];
		invalidCount?: number;
		accountId?: string;
		sampleSize?: number;
		sampleOffset?: number;
	},
): Promise<TransactionImportPreview> {
	const selectedAccount = await resolveImportAccount(ctx, input.accountId);
	const storedAccountFingerprint = input.accountId
		? ((await ctx.repositories.transactions.findAccountFingerprint?.({
				userId: ctx.userId,
				accountId: input.accountId,
			})) ?? null)
		: null;
	const sampleSize = clampSampleSize(input.sampleSize);
	const sampleOffset = clampSampleOffset(input.sampleOffset);

	const incoming = input.normalized.map((row) => ({
		...row,
		dedupeFingerprint: fingerprintImportRow(
			row,
			selectedAccount,
			storedAccountFingerprint,
		),
	}));

	const fingerprints = incoming.map((row) => row.dedupeFingerprint ?? "");
	const existingFingerprints = new Set(
		await ctx.repositories.transactions.findFingerprints({
			userId: ctx.userId,
			fingerprints,
		}),
	);

	const legacySignatures = new Set<string>();
	const listUnfingerprinted =
		ctx.repositories.transactions.listUnfingerprintedForDedupe;
	if (listUnfingerprinted && incoming.length > 0) {
		const times = incoming.map((row) => row.date.getTime());
		const startDate = new Date(Math.min(...times));
		startDate.setUTCHours(0, 0, 0, 0);
		const endDate = new Date(Math.max(...times));
		endDate.setUTCHours(23, 59, 59, 999);
		const legacyRows =
			(await ctx.repositories.transactions.listUnfingerprintedForDedupe?.({
				userId: ctx.userId,
				startDate,
				endDate,
				amounts: incoming.map((row) => row.amount),
			})) ?? [];
		for (const row of legacyRows) {
			legacySignatures.add(importRowSignature(row));
		}
	}

	const seenFingerprints = new Set(existingFingerprints);
	const toImport: NormalizedImportRow[] = [];
	let duplicateCount = 0;

	for (const row of incoming) {
		const fingerprint = row.dedupeFingerprint ?? "";
		const isDuplicate =
			seenFingerprints.has(fingerprint) ||
			legacySignatures.has(importRowSignature(row));
		if (isDuplicate) {
			duplicateCount += 1;
			continue;
		}
		seenFingerprints.add(fingerprint);
		toImport.push(row);
	}

	return {
		headers: input.headers,
		rows: toImport,
		duplicateCount,
		newCount: toImport.length,
		invalidCount: input.invalidCount ?? 0,
		sample: toImport.slice(sampleOffset, sampleOffset + sampleSize),
		categoryColumnMapped: true,
		uncategorizedWarning: null,
	};
}

export async function previewTransactionImport(
	ctx: AppContext,
	input: TransactionImportSource & PreviewSampleWindow,
): Promise<TransactionImportPreview> {
	const source = await resolveImportSource(ctx, input);
	const resolved = resolveImportRows(source);
	const preview = await previewNormalizedImport(ctx, {
		...resolved,
		accountId: source.accountId,
		sampleSize: input.sampleSize,
		sampleOffset: input.sampleOffset,
	});
	return {
		...preview,
		categoryColumnMapped: source.categoryColumnMapped,
		uncategorizedWarning:
			!source.categoryColumnMapped && preview.newCount > 0
				? IMPORT_UNCATEGORIZED_WARNING
				: null,
	};
}

export async function previewCsvImport(
	ctx: AppContext,
	input: {
		csvText: string;
		mapping: CsvColumnMapping;
		accountId?: string;
		sampleSize?: number;
		sampleOffset?: number;
	},
): Promise<ImportPreview & { rows: NormalizedImportRow[] }> {
	const preview = await previewTransactionImport(ctx, {
		csvText: input.csvText,
		mapping: input.mapping,
		accountId: input.accountId,
		sampleSize: input.sampleSize,
		sampleOffset: input.sampleOffset,
	});
	return {
		headers: preview.headers,
		rows: preview.rows,
		duplicateCount: preview.duplicateCount,
		newCount: preview.newCount,
	};
}

export async function commitCsvImport(
	ctx: AppContext,
	input: {
		rows: NormalizedImportRow[];
		accountId?: string;
	},
): Promise<ImportResult> {
	if (input.rows.length === 0) {
		return { imported: 0, skipped: 0, transactionIds: [] };
	}

	const selectedAccount = await resolveImportAccount(ctx, input.accountId);
	const storedAccountFingerprint = input.accountId
		? ((await ctx.repositories.transactions.findAccountFingerprint?.({
				userId: ctx.userId,
				accountId: input.accountId,
			})) ?? null)
		: null;

	const categoryMap = new Map<string, string>();
	if (ctx.repositories.categories) {
		const allCategories = await ctx.repositories.categories.listAll({
			userId: ctx.userId,
			includeHidden: true,
		});
		for (const cat of allCategories) {
			if (cat.isRemoved) continue;
			categoryMap.set(cat.name.toLowerCase(), cat.id);
		}
	}

	const toCreate: CreateTransactionInput[] = input.rows.map((row) => {
		let categoryId: string | null = null;
		if (row.category && ctx.repositories.categories) {
			categoryId = categoryMap.get(row.category.toLowerCase()) ?? null;
		}

		return {
			id: randomUUID(),
			date: row.date,
			amount: row.amount,
			type: row.type,
			description: row.description,
			originalDescription: row.originalDescription ?? null,
			accountId: input.accountId ?? null,
			categoryId,
			dedupeFingerprint:
				row.dedupeFingerprint ??
				fingerprintImportRow(row, selectedAccount, storedAccountFingerprint),
		};
	});

	const imported = await ctx.repositories.transactions.createMany({
		userId: ctx.userId,
		transactions: toCreate,
	});

	return {
		imported,
		skipped: input.rows.length - imported,
		transactionIds: toCreate.flatMap((row) => (row.id ? [row.id] : [])),
	};
}

export async function commitTransactionImport(
	ctx: AppContext,
	input: TransactionImportSource & {
		confirmedNewCount: number;
	},
): Promise<TransactionImportCommitResult> {
	const source = await resolveImportSource(ctx, input);
	const preview = await previewTransactionImport(ctx, source);
	if (preview.newCount !== input.confirmedNewCount) {
		return {
			status: "confirmation_mismatch",
			actualNewCount: preview.newCount,
			duplicateCount: preview.duplicateCount,
			invalidCount: preview.invalidCount,
		};
	}

	const result = await commitCsvImport(ctx, {
		rows: preview.rows,
		accountId: source.accountId,
	});

	return {
		status: "applied",
		imported: result.imported,
		skipped: result.skipped,
		newCount: preview.newCount,
		duplicateCount: preview.duplicateCount,
		invalidCount: preview.invalidCount,
		transactionIds: result.transactionIds,
	};
}
