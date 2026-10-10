import {
	commitTransactionImportInputSchema,
	createImportMappingTemplateInputSchema,
	DetectColumnsInputSchema,
	deleteImportMappingTemplateInputSchema,
	IMPORT_CHANNELS,
	previewTransactionImportInputSchema,
	updateImportMappingTemplateInputSchema,
} from "@moat/contracts";
import {
	autoDetectColumns,
	commitTransactionImport,
	createImportMappingTemplate,
	deleteImportMappingTemplate,
	formatImportSampleRow,
	listImportMappingTemplates,
	previewTransactionImport,
	TransactionImportError,
	toImportMappingTemplateDto,
	updateImportMappingTemplate,
} from "@moat/domain";
import { ipcMain } from "electron";
import { readCsvFromFilePath } from "../lib/read-import-csv-file";
import { remoteLogger } from "../lib/remote-logger";
import { applyRulesAndPairImportedTransactions } from "../services/import-post-process";
import { getUnlockedDesktopDb } from "./vault-guard";

async function toDomainImportSource(input: {
	accountId?: string;
	rows?: Parameters<typeof previewTransactionImport>[1]["rows"];
	csvText?: string;
	mapping?: Parameters<typeof previewTransactionImport>[1]["mapping"];
	templateId?: string;
	headers?: string[];
	rawRows?: Parameters<typeof previewTransactionImport>[1]["rawRows"];
	filePath?: string;
}) {
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

export function registerImportHandlers(): void {
	ipcMain.handle(
		IMPORT_CHANNELS.detectColumns,
		async (_event, raw: unknown) => {
			const { headers } = DetectColumnsInputSchema.parse(raw);
			return autoDetectColumns(headers);
		},
	);

	ipcMain.handle(IMPORT_CHANNELS.previewCsv, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = previewTransactionImportInputSchema.parse(raw);
		try {
			const preview = await previewTransactionImport(
				appCtx,
				await toDomainImportSource(input),
			);
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
			remoteLogger.warn("Desktop CSV import preview failed", {
				event: "desktop.transaction_import.preview_failed",
				feature: "transaction_import",
				operation: "previewCsv",
				metadata: {
					code:
						error instanceof TransactionImportError ? error.code : "unknown",
				},
			});
			throw error;
		}
	});

	ipcMain.handle(IMPORT_CHANNELS.commitCsv, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = commitTransactionImportInputSchema.parse(raw);
		try {
			const result = await commitTransactionImport(appCtx, {
				...(await toDomainImportSource(input)),
				confirmedNewCount: input.confirmedNewCount,
			});

			if (result.status === "confirmation_mismatch") {
				remoteLogger.warn("Desktop CSV import confirmation mismatch", {
					event: "desktop.transaction_import.confirmation_mismatch",
					feature: "transaction_import",
					operation: "commitCsv",
					metadata: {
						actualNewCount: result.actualNewCount,
						duplicateCount: result.duplicateCount,
						invalidCount: result.invalidCount,
					},
				});
				return result;
			}

			await applyRulesAndPairImportedTransactions(
				appCtx,
				result.transactionIds,
			);

			remoteLogger.info("Desktop CSV import committed", {
				event: "desktop.transaction_import.committed",
				feature: "transaction_import",
				operation: "commitCsv",
				metadata: {
					imported: result.imported,
					skipped: result.skipped,
					duplicateCount: result.duplicateCount,
					invalidCount: result.invalidCount,
					hadAccount: Boolean(input.accountId),
				},
			});

			return result;
		} catch (error) {
			remoteLogger.error("Desktop CSV import commit failed", {
				event: "desktop.transaction_import.commit_failed",
				feature: "transaction_import",
				operation: "commitCsv",
				metadata: {
					errorMessage: error instanceof Error ? error.message : "unknown",
				},
			});
			throw error;
		}
	});

	ipcMain.handle(IMPORT_CHANNELS.listTemplates, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		const templates = await listImportMappingTemplates(appCtx);
		return { templates: templates.map(toImportMappingTemplateDto) };
	});

	ipcMain.handle(
		IMPORT_CHANNELS.createTemplate,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const parsed = createImportMappingTemplateInputSchema.parse(raw ?? {});
			const created = await createImportMappingTemplate(appCtx, {
				name: parsed.name,
				mapping: parsed.mapping,
				accountId: parsed.accountId ?? null,
				isDefault: parsed.isDefault ?? false,
			});
			return toImportMappingTemplateDto(created);
		},
	);

	ipcMain.handle(
		IMPORT_CHANNELS.updateTemplate,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const parsed = updateImportMappingTemplateInputSchema.parse(raw ?? {});
			const updated = await updateImportMappingTemplate(appCtx, parsed);
			return toImportMappingTemplateDto(updated);
		},
	);

	ipcMain.handle(
		IMPORT_CHANNELS.deleteTemplate,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const parsed = deleteImportMappingTemplateInputSchema.parse(raw ?? {});
			await deleteImportMappingTemplate(appCtx, parsed.id);
			return { success: true as const };
		},
	);
}
