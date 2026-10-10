import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	IpcTaxConfirmFactInputSchema,
	IpcTaxCreateManualFactInputSchema,
	IpcTaxGetDocumentInputSchema,
	IpcTaxIdInputSchema,
	IpcTaxListFactsInputSchema,
	IpcTaxRenameDocumentInputSchema,
	IpcTaxResolveConflictInputSchema,
	IpcTaxSearchInputSchema,
	IpcTaxUpdateFactInputSchema,
	IpcTaxUploadDocumentInputSchema,
	IpcTaxYearInputSchema,
	TAX_CHANNELS,
	TAXES_PRODUCT_ENABLED,
} from "@moat/contracts";
import {
	confirmTaxFact,
	createManualTaxFact,
	deleteTaxDocument,
	type FileStorageProvider,
	getTaxAgentContext,
	getTaxDocument,
	getTaxFact,
	getTaxOverview,
	getTaxReadiness,
	getTaxYearProfile,
	listTaxConflicts,
	listTaxDocuments,
	listTaxFacts,
	listTaxYears,
	renameTaxDocument,
	reprocessTaxDocument,
	resolveTaxConflict,
	searchTaxData,
	type TaxRuntime,
	updateTaxFact,
	uploadTaxDocument,
} from "@moat/domain";
import { app, ipcMain } from "electron";
import { remoteLogger } from "../lib/remote-logger";
import { MoatApiDoclingParser } from "../taxes/api-docling-parser";
import { getUnlockedDesktopDb } from "./vault-guard";

function createVaultTaxFileStorage(): FileStorageProvider {
	const root = path.join(app.getPath("userData"), "tax-files");
	return {
		async put(input) {
			const filePath = path.join(root, input.key);
			await mkdir(path.dirname(filePath), { recursive: true });
			await writeFile(filePath, input.bytes);
			await writeFile(`${filePath}.mime`, input.mimeType, "utf8");
			return { key: input.key };
		},
		async get(key) {
			const filePath = path.join(root, key);
			const bytes = new Uint8Array(await readFile(filePath));
			const mimeType = await readFile(`${filePath}.mime`, "utf8").catch(
				() => "application/octet-stream",
			);
			return { bytes, mimeType };
		},
		async delete(key) {
			const filePath = path.join(root, key);
			await rm(filePath, { force: true });
			await rm(`${filePath}.mime`, { force: true });
		},
	};
}

export function getDesktopTaxRuntime(): TaxRuntime {
	return {
		storage: createVaultTaxFileStorage(),
		parser: new MoatApiDoclingParser(),
		logError: (message, context) => {
			const metadata: Record<string, string | number | boolean> = {};
			for (const [key, value] of Object.entries(context)) {
				if (value !== null) metadata[key] = value;
			}
			remoteLogger.error(message, {
				feature: "taxes",
				operation: "parse_document",
				metadata,
			});
		},
	};
}

function taxRuntime(): TaxRuntime {
	return getDesktopTaxRuntime();
}

export function registerTaxHandlers(): void {
	if (!TAXES_PRODUCT_ENABLED) {
		for (const channel of Object.values(TAX_CHANNELS)) {
			ipcMain.handle(channel, async () => {
				throw new Error("Taxes is not available");
			});
		}
		return;
	}

	ipcMain.handle(TAX_CHANNELS.listYears, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		return listTaxYears(appCtx);
	});
	ipcMain.handle(TAX_CHANNELS.getOverview, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return getTaxOverview(appCtx, IpcTaxYearInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.getReadiness, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return getTaxReadiness(appCtx, IpcTaxYearInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.getYearProfile, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return getTaxYearProfile(appCtx, IpcTaxYearInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.getAgentContext, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return getTaxAgentContext(appCtx, IpcTaxYearInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.listDocuments, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return listTaxDocuments(appCtx, IpcTaxYearInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.getDocument, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return getTaxDocument(
			appCtx,
			IpcTaxGetDocumentInputSchema.parse(raw),
			taxRuntime(),
		);
	});
	ipcMain.handle(TAX_CHANNELS.uploadDocument, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return uploadTaxDocument(
			appCtx,
			taxRuntime(),
			IpcTaxUploadDocumentInputSchema.parse(raw),
		);
	});
	ipcMain.handle(TAX_CHANNELS.reprocessDocument, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return reprocessTaxDocument(
			appCtx,
			taxRuntime(),
			IpcTaxIdInputSchema.parse(raw),
		);
	});
	ipcMain.handle(TAX_CHANNELS.renameDocument, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return renameTaxDocument(
			appCtx,
			IpcTaxRenameDocumentInputSchema.parse(raw),
		);
	});
	ipcMain.handle(TAX_CHANNELS.deleteDocument, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		await deleteTaxDocument(
			appCtx,
			taxRuntime(),
			IpcTaxIdInputSchema.parse(raw),
		);
	});
	ipcMain.handle(TAX_CHANNELS.listFacts, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return listTaxFacts(appCtx, IpcTaxListFactsInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.getFact, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return getTaxFact(appCtx, IpcTaxIdInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.createManualFact, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return createManualTaxFact(
			appCtx,
			IpcTaxCreateManualFactInputSchema.parse(raw),
		);
	});
	ipcMain.handle(TAX_CHANNELS.updateFact, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return updateTaxFact(appCtx, IpcTaxUpdateFactInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.confirmFact, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return confirmTaxFact(appCtx, IpcTaxConfirmFactInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.listConflicts, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return listTaxConflicts(appCtx, IpcTaxYearInputSchema.parse(raw));
	});
	ipcMain.handle(TAX_CHANNELS.resolveConflict, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return resolveTaxConflict(
			appCtx,
			IpcTaxResolveConflictInputSchema.parse(raw),
		);
	});
	ipcMain.handle(TAX_CHANNELS.searchTaxData, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		return searchTaxData(appCtx, IpcTaxSearchInputSchema.parse(raw));
	});
}
