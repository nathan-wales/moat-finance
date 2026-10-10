import { createTransactionDedupeFingerprint } from "@moat/financial-data-providers";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { Prisma } from "../../../generated/prisma";
import { recordSyncedAccountHistory } from "./account-balance-history.service";
import {
	createAppleFinanceKitImportSignalAccumulator,
	logAppleFinanceKitImportSignalSummary,
	recordAppleFinanceKitImportSignal,
} from "./apple-financekit-import-signal-logging";
import {
	buildAppleFinanceKitExternalTransactionId,
	mapAppleFinanceKitCategoryDetailed,
	mapAppleFinanceKitTransactionType,
	parseAppleFinanceKitDate,
} from "./apple-financekit-mapping";
import { buildAppleFinanceKitRawPayload } from "./apple-financekit-mcc-mapping";
import { loadCategoryNameToIdMap } from "./category-import.service";
import { applyRulesToSyncedTransactions } from "./transaction-rules-on-import.service";
import { logUncategorizedAppleFinanceKitTransactionImport } from "./uncategorized-transaction-import-logging";

export const APPLE_FINANCEKIT_SOURCE = "APPLE_FINANCEKIT" as const;
export const APPLE_FINANCEKIT_LOOKBACK_DAYS = 365;

/** Rows written per interactive transaction — keeps Neon round-trips under timeout. */
export const APPLE_FINANCEKIT_BULK_IMPORT_WRITE_CHUNK_SIZE = 100;
/** Prefetch / rules `IN (...)` batch size. */
export const APPLE_FINANCEKIT_BULK_IMPORT_LOOKUP_CHUNK_SIZE = 500;
/** Per-chunk interactive transaction timeout (default Prisma timeout is 5s). */
const BULK_IMPORT_TX_TIMEOUT_MS = 20_000;

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

type ExistingAppleFinanceKitTransaction = {
	id: string;
	externalTransactionId: string;
	categoryId: string | null;
	splitGroupId: string | null;
};

type PreparedAppleFinanceKitWrite = {
	externalTransactionId: string;
	existing: ExistingAppleFinanceKitTransaction | null;
	createData: Prisma.TransactionUncheckedCreateInput;
	updateData: Prisma.TransactionUncheckedUpdateInput;
};

export const appleFinanceKitAccountInputSchema = z.object({
	source: z.literal(APPLE_FINANCEKIT_SOURCE),
	externalAccountId: z.string().min(1),
	displayName: z.string().min(1),
	institutionName: z.string().min(1).default("Apple Wallet"),
	accountType: z.string().min(1),
	accountSubtype: z.string().optional().nullable(),
	currency: z.string().min(1).default("USD"),
	currentBalance: z.number().optional().nullable(),
	availableBalance: z.number().optional().nullable(),
	lastSyncedAt: z.string().datetime().optional().nullable(),
});

export const appleFinanceKitTransactionInputSchema = z.object({
	externalTransactionId: z.string().min(1),
	date: z.string().min(1),
	authorizedDate: z.string().optional().nullable(),
	amount: z.number(),
	currency: z.string().min(1).default("USD"),
	merchantName: z.string().optional().nullable(),
	description: z.string().min(1),
	pending: z.boolean().default(false),
	category: z.string().optional().nullable(),
	rawCategory: z.string().optional().nullable(),
	pendingTransactionId: z.string().optional().nullable(),
	transactionType: z.string().optional().nullable(),
	foreignCurrencyCode: z.string().optional().nullable(),
	creditDebitIndicator: z.string().optional().nullable(),
	metadata: z.record(z.unknown()).optional(),
});

export const upsertAppleFinanceKitAccountsInputSchema = z.object({
	accounts: z.array(appleFinanceKitAccountInputSchema).min(1).max(20),
});

export const bulkImportAppleFinanceKitTransactionsInputSchema = z.object({
	source: z.literal(APPLE_FINANCEKIT_SOURCE),
	externalAccountId: z.string().min(1),
	transactions: z.array(appleFinanceKitTransactionInputSchema).max(5000),
	/** FinanceKit change streams report deletions; these are provider IDs, not prefixed IDs. */
	deletedExternalTransactionIds: z
		.array(z.string().min(1))
		.max(5000)
		.optional(),
});

export type AppleFinanceKitAccountInput = z.infer<
	typeof appleFinanceKitAccountInputSchema
>;
export type AppleFinanceKitTransactionInput = z.infer<
	typeof appleFinanceKitTransactionInputSchema
>;

export async function upsertAppleFinanceKitAccounts(input: {
	userId: string;
	accounts: AppleFinanceKitAccountInput[];
}) {
	const now = new Date();
	const rows = await db.$transaction(
		input.accounts.map((account) =>
			db.appleFinanceKitAccount.upsert({
				where: {
					userId_externalAccountId: {
						userId: input.userId,
						externalAccountId: account.externalAccountId,
					},
				},
				create: {
					userId: input.userId,
					externalAccountId: account.externalAccountId,
					displayName: account.displayName,
					institutionName: account.institutionName,
					accountType: account.accountType,
					accountSubtype: account.accountSubtype ?? null,
					currency: account.currency,
					currentBalance: account.currentBalance ?? null,
					availableBalance: account.availableBalance ?? null,
					status: "ACTIVE",
					isActive: true,
					lastSyncedAt: account.lastSyncedAt
						? new Date(account.lastSyncedAt)
						: now,
				},
				update: {
					displayName: account.displayName,
					institutionName: account.institutionName,
					accountType: account.accountType,
					accountSubtype: account.accountSubtype ?? null,
					currency: account.currency,
					currentBalance: account.currentBalance ?? null,
					availableBalance: account.availableBalance ?? null,
					status: "ACTIVE",
					isActive: true,
					lastSyncedAt: account.lastSyncedAt
						? new Date(account.lastSyncedAt)
						: now,
				},
				select: {
					id: true,
					externalAccountId: true,
					displayName: true,
					lastSyncedAt: true,
				},
			}),
		),
	);

	try {
		await recordSyncedAccountHistory(input.userId, db);
	} catch (error) {
		logger.logError("Account history failed after Apple Wallet upsert", error, {
			feature: "account-balance-history",
			operation: "upsertAppleFinanceKitAccounts",
			userId: input.userId,
		});
	}

	return {
		accountCount: rows.length,
		accounts: rows,
	};
}

export class AppleFinanceKitAccountNotFoundError extends Error {
	constructor() {
		super("Apple Wallet account not found for user");
		this.name = "AppleFinanceKitAccountNotFoundError";
	}
}

export function requireAppleFinanceKitAccount<
	T extends { id: string; displayName: string; externalAccountId: string },
>(account: T | null): T {
	if (!account) {
		throw new AppleFinanceKitAccountNotFoundError();
	}

	return account;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
	if (size <= 0) {
		throw new Error("chunk size must be greater than 0");
	}
	if (array.length === 0) return [];

	const chunks: T[][] = [];
	for (let index = 0; index < array.length; index += size) {
		chunks.push(array.slice(index, index + size));
	}
	return chunks;
}

export async function bulkImportAppleFinanceKitTransactions(input: {
	userId: string;
	externalAccountId: string;
	transactions: AppleFinanceKitTransactionInput[];
	deletedExternalTransactionIds?: string[];
}) {
	const importStartedAt = Date.now();
	const account = requireAppleFinanceKitAccount(
		await db.appleFinanceKitAccount.findFirst({
			where: {
				userId: input.userId,
				externalAccountId: input.externalAccountId,
				status: "ACTIVE",
				isActive: true,
			},
			select: {
				id: true,
				displayName: true,
				externalAccountId: true,
				currency: true,
			},
		}),
	);

	const removedCount = await softDeleteAppleFinanceKitTransactions({
		userId: input.userId,
		appleFinanceKitAccountId: account.id,
		providerTransactionIds: input.deletedExternalTransactionIds ?? [],
	});

	if (input.transactions.length === 0) {
		await db.appleFinanceKitAccount.update({
			where: { id: account.id },
			data: { lastSyncedAt: new Date() },
		});
		return { importedCount: 0, updatedCount: 0, removedCount, totalCount: 0 };
	}

	const { categoryNameToId, uncategorizedCategoryId } =
		await loadCategoryNameToIdMap(input.userId);

	const signalAccumulator = createAppleFinanceKitImportSignalAccumulator();
	const uniqueTransactions = dedupeAppleFinanceKitTransactionsByExternalId(
		input.transactions,
	);
	const externalIds = uniqueTransactions.map((transaction) =>
		buildAppleFinanceKitExternalTransactionId(
			transaction.externalTransactionId,
		),
	);
	const existingByExternalId =
		await prefetchExistingAppleFinanceKitTransactions(
			input.userId,
			externalIds,
		);

	const preparedWrites: PreparedAppleFinanceKitWrite[] = [];
	for (const transaction of uniqueTransactions) {
		const prepared = prepareAppleFinanceKitTransactionWrite({
			userId: input.userId,
			account,
			transaction,
			categoryNameToId,
			uncategorizedCategoryId,
			existingByExternalId,
			signalAccumulator,
		});
		preparedWrites.push(prepared);
	}

	let importedCount = 0;
	let updatedCount = 0;
	const writeChunks = chunkArray(
		preparedWrites,
		APPLE_FINANCEKIT_BULK_IMPORT_WRITE_CHUNK_SIZE,
	);

	for (const chunk of writeChunks) {
		const chunkCounts = await db.$transaction(
			async (tx) => writeAppleFinanceKitTransactionChunk(tx, chunk),
			{ timeout: BULK_IMPORT_TX_TIMEOUT_MS },
		);
		importedCount += chunkCounts.importedCount;
		updatedCount += chunkCounts.updatedCount;
	}

	await db.appleFinanceKitAccount.update({
		where: { id: account.id },
		data: { lastSyncedAt: new Date() },
	});

	logAppleFinanceKitImportSignalSummary({
		userId: input.userId,
		externalAccountIdPrefix: account.externalAccountId,
		accountCurrency: account.currency,
		accumulator: signalAccumulator,
	});

	logger.info("Apple FinanceKit bulk import persisted", {
		feature: "apple-financekit",
		operation: "bulkImportTransactions",
		userId: input.userId,
		importedCount,
		updatedCount,
		removedCount,
		totalCount: input.transactions.length,
		chunkCount: writeChunks.length,
		durationMs: Date.now() - importStartedAt,
	});

	try {
		for (const rulesChunk of chunkArray(
			externalIds,
			APPLE_FINANCEKIT_BULK_IMPORT_LOOKUP_CHUNK_SIZE,
		)) {
			await applyRulesToSyncedTransactions(input.userId, rulesChunk);
		}
	} catch (error) {
		logger.logError("Failed to apply rules to Apple FinanceKit import", error, {
			feature: "apple-financekit",
			operation: "bulkImportTransactions",
			userId: input.userId,
			transactionCount: externalIds.length,
		});
	}

	return {
		importedCount,
		updatedCount,
		removedCount,
		totalCount: input.transactions.length,
	};
}

/**
 * Mirrors the Plaid removal path: rows are soft-deleted via `removedAt` so history and any
 * user edits survive, and scoping stays on the caller's own Apple Wallet account.
 */
async function softDeleteAppleFinanceKitTransactions(input: {
	userId: string;
	appleFinanceKitAccountId: string;
	providerTransactionIds: string[];
}): Promise<number> {
	if (input.providerTransactionIds.length === 0) return 0;

	const externalIds = input.providerTransactionIds.map(
		buildAppleFinanceKitExternalTransactionId,
	);
	const now = new Date();
	let removedCount = 0;

	for (const idChunk of chunkArray(
		externalIds,
		APPLE_FINANCEKIT_BULK_IMPORT_LOOKUP_CHUNK_SIZE,
	)) {
		const result = await db.transaction.updateMany({
			where: {
				userId: input.userId,
				appleFinanceKitAccountId: input.appleFinanceKitAccountId,
				source: APPLE_FINANCEKIT_SOURCE,
				externalTransactionId: { in: idChunk },
				removedAt: null,
			},
			data: { removedAt: now },
		});
		removedCount += result.count;
	}

	return removedCount;
}

function dedupeAppleFinanceKitTransactionsByExternalId(
	transactions: AppleFinanceKitTransactionInput[],
): AppleFinanceKitTransactionInput[] {
	const latestByExternalId = new Map<string, AppleFinanceKitTransactionInput>();
	for (const transaction of transactions) {
		latestByExternalId.set(
			buildAppleFinanceKitExternalTransactionId(
				transaction.externalTransactionId,
			),
			transaction,
		);
	}
	return [...latestByExternalId.values()];
}

async function prefetchExistingAppleFinanceKitTransactions(
	userId: string,
	externalIds: string[],
): Promise<Map<string, ExistingAppleFinanceKitTransaction>> {
	const existingByExternalId = new Map<
		string,
		ExistingAppleFinanceKitTransaction
	>();

	for (const idChunk of chunkArray(
		externalIds,
		APPLE_FINANCEKIT_BULK_IMPORT_LOOKUP_CHUNK_SIZE,
	)) {
		const rows = await db.transaction.findMany({
			where: {
				userId,
				externalTransactionId: { in: idChunk },
			},
			select: {
				id: true,
				externalTransactionId: true,
				categoryId: true,
				splitGroupId: true,
			},
		});

		for (const row of rows) {
			if (!row.externalTransactionId) continue;
			existingByExternalId.set(row.externalTransactionId, {
				id: row.id,
				externalTransactionId: row.externalTransactionId,
				categoryId: row.categoryId,
				splitGroupId: row.splitGroupId,
			});
		}
	}

	return existingByExternalId;
}

function prepareAppleFinanceKitTransactionWrite(input: {
	userId: string;
	account: {
		id: string;
		displayName: string;
		externalAccountId: string;
		currency: string;
	};
	transaction: AppleFinanceKitTransactionInput;
	categoryNameToId: Map<string, string>;
	uncategorizedCategoryId: string;
	existingByExternalId: Map<string, ExistingAppleFinanceKitTransaction>;
	signalAccumulator: ReturnType<
		typeof createAppleFinanceKitImportSignalAccumulator
	>;
}): PreparedAppleFinanceKitWrite {
	const postedDate =
		parseAppleFinanceKitDate(input.transaction.date) ?? new Date();
	const authorizedDate = parseAppleFinanceKitDate(
		input.transaction.authorizedDate,
	);
	const absoluteAmount = Math.abs(input.transaction.amount).toFixed(2);
	const type = mapAppleFinanceKitTransactionType(input.transaction.amount);
	const externalTransactionId = buildAppleFinanceKitExternalTransactionId(
		input.transaction.externalTransactionId,
	);
	const categoryMapping = mapAppleFinanceKitCategoryDetailed({
		rawCategory: input.transaction.rawCategory,
		category: input.transaction.category,
		transactionType: input.transaction.transactionType,
		creditDebitIndicator: input.transaction.creditDebitIndicator,
		amount: input.transaction.amount,
	});
	const categoryFromApple = categoryMapping.category;
	const resolvedCategoryId =
		input.categoryNameToId.get(categoryFromApple.toLowerCase()) ??
		input.uncategorizedCategoryId;
	const existing =
		input.existingByExternalId.get(externalTransactionId) ?? null;
	const isExistingUncategorized =
		!!existing?.categoryId &&
		existing.categoryId === input.uncategorizedCategoryId;
	const shouldApplyMappedCategory =
		!existing?.splitGroupId &&
		(!existing?.categoryId ||
			(isExistingUncategorized && categoryFromApple !== "Uncategorized"));
	const preservesExistingCategory = !!existing && !shouldApplyMappedCategory;

	const rawSignals = {
		transactionType: input.transaction.transactionType,
		foreignCurrencyCode: input.transaction.foreignCurrencyCode,
		creditDebitIndicator: input.transaction.creditDebitIndicator,
	};
	const rawPayload = toJson(
		buildAppleFinanceKitRawPayload(
			input.transaction.metadata,
			input.transaction.rawCategory,
			rawSignals,
		),
	);
	const dedupeFingerprint = createTransactionDedupeFingerprint({
		accountFingerprint: input.account.externalAccountId,
		amount: Math.abs(input.transaction.amount),
		date: postedDate,
		merchantName: input.transaction.merchantName,
		description: input.transaction.description,
		pending: input.transaction.pending,
	});

	recordAppleFinanceKitImportSignal({
		accumulator: input.signalAccumulator,
		transaction: input.transaction,
		mappedCategory: categoryFromApple,
		mappingReason: categoryMapping.mappingReason,
		accountCurrency: input.account.currency,
	});

	logUncategorizedAppleFinanceKitTransactionImport({
		userId: input.userId,
		transaction: input.transaction,
		mappedCategory: categoryFromApple,
		mappingReason: categoryMapping.mappingReason,
		resolvedCategoryId,
		uncategorizedCategoryId: input.uncategorizedCategoryId,
		importKind: existing ? "updated" : "added",
		preservesExistingCategory,
		accountCurrency: input.account.currency,
	});

	const updateData: Prisma.TransactionUncheckedUpdateInput = {
		date: postedDate,
		postedDate,
		authorizedDate,
		...(existing?.splitGroupId ? {} : { amount: absoluteAmount }),
		isoCurrencyCode: input.transaction.currency,
		type,
		description: input.transaction.description,
		merchantName: input.transaction.merchantName ?? null,
		account: input.account.displayName,
		source: "APPLE_FINANCEKIT",
		appleFinanceKitAccountId: input.account.id,
		providerAccountId: input.account.externalAccountId,
		providerTransactionId: input.transaction.externalTransactionId,
		dedupeFingerprint,
		pending: input.transaction.pending,
		pendingTransactionId: input.transaction.pendingTransactionId ?? null,
		removedAt: null,
		raw: rawPayload,
	};

	if (shouldApplyMappedCategory) {
		updateData.category = categoryFromApple;
		updateData.categoryId = resolvedCategoryId;
	}

	return {
		externalTransactionId,
		existing,
		createData: {
			userId: input.userId,
			date: postedDate,
			postedDate,
			authorizedDate,
			amount: absoluteAmount,
			isoCurrencyCode: input.transaction.currency,
			type,
			category: categoryFromApple,
			categoryId: resolvedCategoryId,
			description: input.transaction.description,
			merchantName: input.transaction.merchantName ?? null,
			account: input.account.displayName,
			source: "APPLE_FINANCEKIT",
			externalTransactionId,
			pendingTransactionId: input.transaction.pendingTransactionId ?? null,
			appleFinanceKitAccountId: input.account.id,
			providerAccountId: input.account.externalAccountId,
			providerTransactionId: input.transaction.externalTransactionId,
			dedupeFingerprint,
			pending: input.transaction.pending,
			raw: rawPayload,
		},
		updateData,
	};
}

export function omitMappedCategoryFromUpdate(
	updateData: Prisma.TransactionUncheckedUpdateInput,
): Prisma.TransactionUncheckedUpdateInput {
	const rest = { ...updateData };
	delete rest.category;
	delete rest.categoryId;
	return rest;
}

export function partitionAppleFinanceKitWritesForLiveExisting<
	T extends {
		externalTransactionId: string;
		existing: { id: string } | null;
		updateData: Prisma.TransactionUncheckedUpdateInput;
	},
>(
	chunk: T[],
	liveExistingByExternalId: Map<string, { id: string }>,
): {
	toCreate: T[];
	toUpdate: Array<{
		existingId: string;
		updateData: Prisma.TransactionUncheckedUpdateInput;
	}>;
} {
	const toCreate: T[] = [];
	const toUpdate: Array<{
		existingId: string;
		updateData: Prisma.TransactionUncheckedUpdateInput;
	}> = [];

	for (const row of chunk) {
		const liveExisting = liveExistingByExternalId.get(
			row.externalTransactionId,
		);
		if (!liveExisting) {
			toCreate.push(row);
			continue;
		}

		toUpdate.push({
			existingId: liveExisting.id,
			updateData: row.existing
				? row.updateData
				: omitMappedCategoryFromUpdate(row.updateData),
		});
	}

	return { toCreate, toUpdate };
}

async function writeAppleFinanceKitTransactionChunk(
	tx: TransactionClient,
	chunk: PreparedAppleFinanceKitWrite[],
): Promise<{ importedCount: number; updatedCount: number }> {
	const userId = chunk[0]?.createData.userId;
	if (!userId || chunk.length === 0) {
		return { importedCount: 0, updatedCount: 0 };
	}

	const liveRows = await tx.transaction.findMany({
		where: {
			userId,
			externalTransactionId: {
				in: chunk.map((row) => row.externalTransactionId),
			},
		},
		select: {
			id: true,
			externalTransactionId: true,
		},
	});
	const liveExistingByExternalId = new Map<string, { id: string }>();
	for (const row of liveRows) {
		if (!row.externalTransactionId) continue;
		liveExistingByExternalId.set(row.externalTransactionId, { id: row.id });
	}

	const { toCreate, toUpdate } = partitionAppleFinanceKitWritesForLiveExisting(
		chunk,
		liveExistingByExternalId,
	);

	let importedCount = 0;
	if (toCreate.length > 0) {
		const result = await tx.transaction.createMany({
			data: toCreate.map((row) => row.createData),
			skipDuplicates: true,
		});
		importedCount = result.count;
		const skippedCount = toCreate.length - result.count;
		if (skippedCount > 0) {
			logger.warn("Apple FinanceKit createMany skipped unique conflicts", {
				feature: "apple-financekit",
				operation: "bulkImportTransactions",
				event: "apple_financekit.bulk_import_unique_conflict",
				userId,
				attemptedCount: toCreate.length,
				insertedCount: result.count,
				skippedCount,
			});
		}
	}

	for (const row of toUpdate) {
		await tx.transaction.update({
			where: { id: row.existingId },
			data: row.updateData,
		});
	}

	return {
		importedCount,
		updatedCount: toUpdate.length,
	};
}

export async function getAppleFinanceKitStatus(userId: string) {
	const accounts = await db.appleFinanceKitAccount.findMany({
		where: { userId, isActive: true },
		orderBy: [{ displayName: "asc" }],
		select: {
			id: true,
			externalAccountId: true,
			displayName: true,
			institutionName: true,
			accountType: true,
			accountSubtype: true,
			currency: true,
			currentBalance: true,
			availableBalance: true,
			status: true,
			accountHidden: true,
			lastSyncedAt: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	const activeAccounts = accounts.filter(
		(account) => account.status === "ACTIVE",
	);
	const lastSyncedAt = activeAccounts.reduce<Date | null>((latest, account) => {
		if (!account.lastSyncedAt) return latest;
		if (!latest || account.lastSyncedAt > latest) {
			return account.lastSyncedAt;
		}
		return latest;
	}, null);

	return {
		connected: activeAccounts.length > 0,
		institutionName: "Apple Wallet",
		lastSyncedAt,
		accounts,
	};
}

export async function disconnectAppleFinanceKit(input: {
	userId: string;
	externalAccountId?: string;
	deleteImportedTransactions?: boolean;
}) {
	const where = {
		userId: input.userId,
		...(input.externalAccountId
			? { externalAccountId: input.externalAccountId }
			: {}),
	};

	const accounts = await db.appleFinanceKitAccount.findMany({
		where,
		select: { id: true },
	});

	if (accounts.length === 0) {
		return { disconnectedCount: 0, deletedTransactionCount: 0 };
	}

	const accountIds = accounts.map((account) => account.id);
	let deletedTransactionCount = 0;

	await db.$transaction(async (tx) => {
		await tx.appleFinanceKitAccount.updateMany({
			where: { id: { in: accountIds } },
			data: {
				status: "DISCONNECTED",
				isActive: false,
			},
		});

		if (input.deleteImportedTransactions) {
			const result = await tx.transaction.deleteMany({
				where: {
					userId: input.userId,
					appleFinanceKitAccountId: { in: accountIds },
					source: "APPLE_FINANCEKIT",
				},
			});
			deletedTransactionCount = result.count;
			return;
		}

		await tx.transaction.updateMany({
			where: {
				userId: input.userId,
				appleFinanceKitAccountId: { in: accountIds },
			},
			data: { appleFinanceKitAccountId: null },
		});
	});

	return {
		disconnectedCount: accounts.length,
		deletedTransactionCount,
	};
}

function toJson(
	value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
	if (value == null) return Prisma.JsonNull;
	return value as Prisma.InputJsonValue;
}
