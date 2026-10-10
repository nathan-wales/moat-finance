import type { DbClient } from "@moat/db-postgres";
import {
	commitTransactionImport,
	formatImportSampleRow,
	previewTransactionImport,
	TransactionImportError,
} from "@moat/domain";
import { logger } from "~/lib/logger";
import { createApiError } from "../api-context";
import { createApiAppContext } from "../createApiAppContext";
import { applyRulesToImportedTransactions } from "./transaction-rules-on-import.service";
import { detectAndPairTransfers } from "./transfer-pairing.service";

type PreviewInput = Parameters<typeof previewTransactionImport>[1];
type CommitInput = Parameters<typeof commitTransactionImport>[1] & {
	confirmed: true;
};

function throwImportError(
	status: number,
	code: string,
	message: string,
	extra?: {
		actualNewCount?: number;
		duplicateCount?: number;
		invalidCount?: number;
	},
): never {
	const error = createApiError(message, status) as Error & {
		status: number;
		code: string;
		actualNewCount?: number;
		duplicateCount?: number;
		invalidCount?: number;
	};
	error.code = code;
	if (extra?.actualNewCount !== undefined) {
		error.actualNewCount = extra.actualNewCount;
	}
	if (extra?.duplicateCount !== undefined) {
		error.duplicateCount = extra.duplicateCount;
	}
	if (extra?.invalidCount !== undefined) {
		error.invalidCount = extra.invalidCount;
	}
	throw error;
}

function mapImportError(
	error: unknown,
	context: { userId: string; operation: "previewImport" | "commitImport" },
): never {
	if (error instanceof TransactionImportError) {
		logger.warn("CSV transaction import rejected", {
			feature: "transaction_import",
			operation: context.operation,
			userId: context.userId,
			code: error.code,
		});
		const status = error.code === "PAYLOAD_TOO_LARGE" ? 413 : 400;
		throwImportError(status, error.code, error.message);
	}

	const alreadyStatus =
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof (error as { status: unknown }).status === "number";
	if (!alreadyStatus) {
		logger.error("CSV transaction import failed", {
			feature: "transaction_import",
			operation: context.operation,
			userId: context.userId,
			error: error instanceof Error ? error.message : "unknown",
		});
	}
	throw error;
}

export async function previewTransactionImportForUser(
	userId: string,
	db: DbClient,
	input: PreviewInput & { filePath?: string },
) {
	if (input.filePath) {
		throwImportError(
			400,
			"FILE_PATH_NOT_SUPPORTED",
			"filePath is only supported on desktop",
		);
	}
	try {
		const appCtx = createApiAppContext(userId, db);
		const preview = await previewTransactionImport(appCtx, input);
		return {
			newCount: preview.newCount,
			duplicateCount: preview.duplicateCount,
			invalidCount: preview.invalidCount,
			headers: preview.headers,
			sample: preview.sample.map(formatImportSampleRow),
			categoryColumnMapped: preview.categoryColumnMapped,
			uncategorizedWarning: preview.uncategorizedWarning,
		};
	} catch (error) {
		mapImportError(error, { userId, operation: "previewImport" });
	}
}

export async function commitTransactionImportForUser(
	userId: string,
	db: DbClient,
	input: CommitInput & { filePath?: string; templateId?: string },
) {
	if (input.filePath) {
		throwImportError(
			400,
			"FILE_PATH_NOT_SUPPORTED",
			"filePath is only supported on desktop",
		);
	}
	try {
		const appCtx = createApiAppContext(userId, db);
		const result = await commitTransactionImport(appCtx, {
			accountId: input.accountId,
			rows: input.rows,
			csvText: input.csvText,
			mapping: input.mapping,
			templateId: input.templateId,
			headers: input.headers,
			rawRows: input.rawRows,
			confirmedNewCount: input.confirmedNewCount,
		});

		if (result.status === "confirmation_mismatch") {
			logger.warn("CSV transaction import confirmation mismatch", {
				feature: "transaction_import",
				operation: "commitImport",
				userId,
				actualNewCount: result.actualNewCount,
				duplicateCount: result.duplicateCount,
				invalidCount: result.invalidCount,
			});
			throwImportError(
				409,
				"confirmation_mismatch",
				"This file changed since preview. Review again.",
				{
					actualNewCount: result.actualNewCount,
					duplicateCount: result.duplicateCount,
					invalidCount: result.invalidCount,
				},
			);
		}

		try {
			await applyRulesToImportedTransactions(userId, result.transactionIds);
		} catch (error) {
			logger.error("CSV import rules failed after insert", {
				feature: "transaction_import",
				operation: "applyRules",
				userId,
				imported: result.imported,
				error: error instanceof Error ? error.message : "unknown",
			});
		}

		try {
			await detectAndPairTransfers({
				userId,
				candidateTransactionIds: result.transactionIds,
			});
		} catch (error) {
			logger.error("CSV import transfer pairing failed after insert", {
				feature: "transaction_import",
				operation: "detectAndPairTransfers",
				userId,
				imported: result.imported,
				error: error instanceof Error ? error.message : "unknown",
			});
		}

		logger.info("CSV transaction import committed", {
			feature: "transaction_import",
			operation: "commitImport",
			userId,
			imported: result.imported,
			skipped: result.skipped,
			duplicateCount: result.duplicateCount,
			invalidCount: result.invalidCount,
			hadAccount: Boolean(input.accountId),
		});

		return {
			imported: result.imported,
			skipped: result.skipped,
			newCount: result.newCount,
			duplicateCount: result.duplicateCount,
			invalidCount: result.invalidCount,
		};
	} catch (error) {
		mapImportError(error, { userId, operation: "commitImport" });
	}
}
