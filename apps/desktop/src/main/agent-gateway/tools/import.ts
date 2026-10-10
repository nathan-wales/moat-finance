import {
	commitTransactionImport,
	previewTransactionImport,
	type TransactionImportSource,
} from "@moat/domain";
import {
	commitTransactionImportInputSchema,
	mcpToolContracts,
	previewTransactionImportInputSchema,
} from "@moat/mcp-contracts";
import { readCsvFromFilePath } from "../../lib/read-import-csv-file";
import type { LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

async function toImportSource(input: {
	accountId?: string;
	rows?: TransactionImportSource["rows"];
	csvText?: string;
	mapping?: TransactionImportSource["mapping"];
	templateId?: string;
	headers?: string[];
	rawRows?: TransactionImportSource["rawRows"];
	filePath?: string;
}): Promise<TransactionImportSource> {
	const csvText = input.filePath
		? await readCsvFromFilePath(input.filePath)
		: input.csvText;
	return {
		accountId: input.accountId,
		rows: input.rows,
		csvText,
		mapping: input.mapping,
		templateId: input.templateId,
		headers: input.headers,
		rawRows: input.rawRows,
	};
}

function formatSampleRow(row: {
	date: Date;
	amount: number;
	type: "INCOME" | "EXPENSE";
	description: string;
	category?: string;
}) {
	return {
		date: row.date.toISOString().slice(0, 10),
		amount: row.amount,
		type: row.type,
		description: row.description,
		...(row.category ? { category: row.category } : {}),
	};
}

export const previewTransactionImportTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.previewTransactionImport"],
	async execute(input, ctx) {
		const parsed = previewTransactionImportInputSchema.parse(input ?? {});
		const preview = await previewTransactionImport(
			ctx.appRuntime,
			await toImportSource(parsed),
		);
		return localSchemaEnvelope("transactions.import_preview", {
			newCount: preview.newCount,
			duplicateCount: preview.duplicateCount,
			invalidCount: preview.invalidCount,
			headers: preview.headers,
			sample: preview.sample.map(formatSampleRow),
			categoryColumnMapped: preview.categoryColumnMapped,
			uncategorizedWarning: preview.uncategorizedWarning,
		});
	},
};

export const commitTransactionImportTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.commitTransactionImport"],
	async execute(input, ctx) {
		const parsed = commitTransactionImportInputSchema.parse(input ?? {});
		const result = await commitTransactionImport(ctx.appRuntime, {
			...(await toImportSource(parsed)),
			confirmedNewCount: parsed.confirmedNewCount,
		});
		if (result.status === "confirmation_mismatch") {
			return localSchemaEnvelope("transactions.import_refused", {
				importStatus: "confirmation_mismatch" as const,
				actualNewCount: result.actualNewCount,
				duplicateCount: result.duplicateCount,
				invalidCount: result.invalidCount,
			});
		}
		const { applyRulesAndPairImportedTransactions } = await import(
			"../../services/import-post-process"
		);
		await applyRulesAndPairImportedTransactions(
			ctx.appRuntime,
			result.transactionIds,
		);
		return localSchemaEnvelope("transactions.import_applied", {
			importStatus: "applied" as const,
			imported: result.imported,
			skipped: result.skipped,
			newCount: result.newCount,
			duplicateCount: result.duplicateCount,
			invalidCount: result.invalidCount,
		});
	},
};
